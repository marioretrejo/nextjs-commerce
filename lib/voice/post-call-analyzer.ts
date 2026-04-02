// Post-call analysis worker.
// After a call ends, this module is invoked (via a background job or
// an API route) to run GPT-4-turbo over the full transcript and extract:
//   - Sentiment score (1-10) and label
//   - Named entities (names, dates, amounts, phone numbers)
//   - Outcome classification (conversion/FTD/no_sale/callback)
//   - Key objections raised
//   - Recommended next action
//   - Brief call summary
import type {
  PostCallAnalysisRequest,
  PostCallAnalysisResult,
  CallOutcome,
  SentimentLabel,
} from './types'

const ANALYSIS_MODEL = 'gpt-4-turbo'
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'

const SYSTEM_PROMPT = `You are an expert call-center analytics AI.
Given a sales call transcript, return a JSON object with EXACTLY these fields:
{
  "sentimentScore": <integer 1-10 where 1=very negative, 10=very positive>,
  "sentimentLabel": <"positive"|"neutral"|"negative">,
  "outcome": <"conversion"|"ftd"|"no_sale"|"callback"|"unknown">,
  "entities": {
    "names": [<customer and agent names mentioned>],
    "dates": [<dates or times mentioned>],
    "amounts": [<monetary values or quantities mentioned>],
    "phoneNumbers": [<phone numbers>],
    "emails": [<email addresses>]
  },
  "objections": [<list of objections raised by the customer>],
  "nextAction": "<recommended follow-up action in one sentence>",
  "summary": "<neutral 2-sentence summary of what happened on the call>"
}
Respond with ONLY valid JSON. No markdown, no explanation.`

export async function analyzeCall(
  request: PostCallAnalysisRequest,
  apiKey: string
): Promise<PostCallAnalysisResult> {
  const transcriptText = request.transcript
    .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
    .join('\n')

  const response = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Call ID: ${request.callId}\n\nTranscript:\n${transcriptText}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
    // Hard timeout: prevent hanging requests from exhausting the server thread pool
    signal: AbortSignal.timeout(60_000),
  })

  if (!response.ok) {
    // Do NOT forward raw API error details to callers (could expose keys/internals)
    const status = response.status
    console.error(`[post-call-analysis] OpenAI returned ${status} for call ${request.callId}`)
    throw new Error(`Post-call analysis service error (${status})`)
  }

  const json = await response.json()
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response from analysis model')

  const parsed = JSON.parse(content) as PostCallAnalysisResult

  // Validate and sanitise
  return {
    sentimentScore: clamp(Math.round(parsed.sentimentScore ?? 5), 1, 10),
    sentimentLabel: validateLabel(parsed.sentimentLabel),
    outcome: validateOutcome(parsed.outcome),
    entities: parsed.entities ?? {},
    objections: Array.isArray(parsed.objections) ? parsed.objections : [],
    nextAction: parsed.nextAction ?? '',
    summary: parsed.summary ?? '',
  }
}

// ── POST /api/voice/calls/:id/analyze ────────────────────────────────────────
// Next.js route handler that triggers post-call analysis and persists results.
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { hashApiKey } from '@/lib/voice/auth'

export async function handleAnalyzeRoute(
  req: NextRequest,
  callId: string
): Promise<NextResponse> {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ownerHash = hashApiKey(session.userId.toString())

  // Fetch transcript
  const [row] = await (db as any).$queryRaw`
    SELECT ct.turns, c.agent_id as "agentId"
    FROM call_transcripts ct
    JOIN voice_calls c ON c.id = ct.call_id
    JOIN voice_agents a ON a.id = c.agent_id
    WHERE ct.call_id = ${callId}::uuid
      AND a.owner_api_key = ${ownerHash}
  `

  if (!row) return NextResponse.json({ error: 'Call or transcript not found' }, { status: 404 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

  const result = await analyzeCall(
    { callId, transcript: row.turns, agentId: row.agentId },
    apiKey
  )

  // Upsert analysis
  await (db as any).$executeRaw`
    INSERT INTO call_analysis (
      call_id, sentiment_score, sentiment_label, outcome, entities,
      objections, next_action, summary, confidence, model_version
    ) VALUES (
      ${callId}::uuid,
      ${result.sentimentScore},
      ${result.sentimentLabel},
      ${result.outcome},
      ${JSON.stringify(result.entities)},
      ${result.objections},
      ${result.nextAction},
      ${result.summary},
      0.9,
      ${ANALYSIS_MODEL}
    )
    ON CONFLICT (call_id) DO UPDATE SET
      sentiment_score = EXCLUDED.sentiment_score,
      sentiment_label = EXCLUDED.sentiment_label,
      outcome         = EXCLUDED.outcome,
      entities        = EXCLUDED.entities,
      objections      = EXCLUDED.objections,
      next_action     = EXCLUDED.next_action,
      summary         = EXCLUDED.summary,
      processed_at    = NOW()
  `

  return NextResponse.json({ analysis: result })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function validateLabel(label: unknown): SentimentLabel {
  const valid: SentimentLabel[] = ['positive', 'neutral', 'negative']
  return valid.includes(label as SentimentLabel) ? (label as SentimentLabel) : 'neutral'
}

function validateOutcome(outcome: unknown): CallOutcome {
  const valid: CallOutcome[] = ['conversion', 'ftd', 'no_sale', 'callback', 'unknown']
  return valid.includes(outcome as CallOutcome) ? (outcome as CallOutcome) : 'unknown'
}
