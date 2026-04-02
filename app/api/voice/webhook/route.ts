// POST /api/voice/webhook
// Receives call lifecycle events from the Go orchestrator.
// Events: call.started | call.ended | call.barge_in | call.transcript
//
// This endpoint is authenticated via HMAC-SHA256 signature (X-Signature-256 header)
// using the shared ORCHESTRATOR_WEBHOOK_SECRET.
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'

type EventType = 'call.started' | 'call.ended' | 'call.barge_in' | 'call.transcript'

interface WebhookEvent {
  type: EventType
  callId: string
  agentId: string
  timestamp: string
  payload: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify HMAC signature
  const signature = req.headers.get('x-signature-256')
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: WebhookEvent
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  switch (event.type) {
    case 'call.started':
      await handleCallStarted(event)
      break
    case 'call.ended':
      await handleCallEnded(event)
      break
    case 'call.barge_in':
      await handleBargeIn(event)
      break
    case 'call.transcript':
      await handleTranscript(event)
      break
    default:
      // Unknown events are acknowledged but not processed
      break
  }

  return NextResponse.json({ received: true })
}

async function handleCallStarted(event: WebhookEvent) {
  await (db as any).$executeRaw`
    UPDATE voice_calls
    SET status = 'active', sip_call_id = ${event.payload.sipCallId ?? null}
    WHERE id = ${event.callId}::uuid
  `
}

async function handleCallEnded(event: WebhookEvent) {
  const { durationS, turnCount, bargeInCount } = event.payload as {
    durationS: number
    turnCount: number
    bargeInCount: number
  }

  await (db as any).$executeRaw`
    UPDATE voice_calls
    SET status = 'completed',
        ended_at = ${event.timestamp}::timestamptz,
        duration_s = ${durationS ?? null},
        turn_count = ${turnCount ?? 0},
        barge_in_count = ${bargeInCount ?? 0}
    WHERE id = ${event.callId}::uuid
  `

  // Trigger async post-call analysis via internal fetch
  // Uses fire-and-forget pattern; errors are logged but not surfaced
  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL ?? 'http://localhost:3000'
  fetch(`${baseUrl}/api/voice/calls/${event.callId}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Internal service token for server-to-server auth
      'x-service-token': process.env.INTERNAL_SERVICE_TOKEN ?? '',
    },
  }).catch((err) => console.error('[post-call-analysis] trigger failed', err))
}

async function handleBargeIn(event: WebhookEvent) {
  await (db as any).$executeRaw`
    UPDATE voice_calls
    SET barge_in_count = barge_in_count + 1
    WHERE id = ${event.callId}::uuid
  `
}

async function handleTranscript(event: WebhookEvent) {
  const { turns, rawText } = event.payload as { turns: unknown[]; rawText: string }

  await (db as any).$executeRaw`
    INSERT INTO call_transcripts (call_id, turns, raw_text)
    VALUES (${event.callId}::uuid, ${JSON.stringify(turns)}, ${rawText ?? ''})
    ON CONFLICT (call_id) DO UPDATE
      SET turns = EXCLUDED.turns, raw_text = EXCLUDED.raw_text
  `
}

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.ORCHESTRATOR_WEBHOOK_SECRET
  if (!secret) {
    // Signature verification disabled in development
    return process.env.NODE_ENV !== 'production'
  }
  if (!signature?.startsWith('sha256=')) return false

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
