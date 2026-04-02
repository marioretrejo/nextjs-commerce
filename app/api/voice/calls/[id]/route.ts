// GET    /api/voice/calls/:id              – call detail + transcript + analysis
// DELETE /api/voice/calls/:id              – force-end an active call
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { hashApiKey } from '@/lib/voice/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const ownerHash = hashApiKey(session.userId.toString())

  const [call] = await (db as any).$queryRaw`
    SELECT
      c.id, c.agent_id as "agentId", c.caller_number as "callerNumber",
      c.direction, c.sip_call_id as "sipCallId", c.status,
      c.started_at as "startedAt", c.ended_at as "endedAt",
      c.duration_s as "durationS", c.barge_in_count as "bargeInCount",
      c.turn_count as "turnCount", c.metadata,
      a.name as "agentName"
    FROM voice_calls c
    JOIN voice_agents a ON a.id = c.agent_id
    WHERE c.id = ${id}::uuid AND a.owner_api_key = ${ownerHash}
  `
  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch transcript
  const [transcript] = await (db as any).$queryRaw`
    SELECT turns, raw_text as "rawText", created_at as "createdAt"
    FROM call_transcripts
    WHERE call_id = ${id}::uuid
  `

  // Fetch analysis
  const [analysis] = await (db as any).$queryRaw`
    SELECT sentiment_score as "sentimentScore", sentiment_label as "sentimentLabel",
           outcome, entities, objections, next_action as "nextAction",
           summary, confidence, processed_at as "processedAt"
    FROM call_analysis
    WHERE call_id = ${id}::uuid
  `

  // Fetch per-turn latency metrics
  const metrics = await (db as any).$queryRaw`
    SELECT turn_id as "turnId", end_of_speech_at as "endOfSpeechAt",
           ttfb_ms as "ttfbMs", llm_latency_ms as "llmLatencyMs",
           tts_latency_ms as "ttsLatencyMs", stt_confidence as "sttConfidence"
    FROM call_turn_metrics
    WHERE call_id = ${id}::uuid
    ORDER BY end_of_speech_at ASC
  `

  return NextResponse.json({ call, transcript, analysis, metrics })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const ownerHash = hashApiKey(session.userId.toString())

  // Only mark as failed if it's still active
  const [result] = await (db as any).$queryRaw`
    UPDATE voice_calls c
    SET status = 'failed', ended_at = NOW()
    FROM voice_agents a
    WHERE c.id = ${id}::uuid
      AND c.agent_id = a.id
      AND a.owner_api_key = ${ownerHash}
      AND c.status = 'active'
    RETURNING c.id
  `

  if (!result) return NextResponse.json({ error: 'Call not found or not active' }, { status: 404 })
  return NextResponse.json({ success: true })
}
