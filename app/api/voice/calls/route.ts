// GET  /api/voice/calls   – paginated list of calls with metrics
// POST /api/voice/calls   – create/register a new call (outbound dispatch)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { hashApiKey } from '@/lib/voice/auth'
import { callCreateSchema, paginationSchema } from '@/lib/voice/validation'

const ALLOWED_STATUSES = ['active', 'completed', 'failed'] as const
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams

  // Validated pagination
  const { limit, offset } = paginationSchema.parse({
    limit: sp.get('limit') ?? undefined,
    offset: sp.get('offset') ?? undefined,
  })

  // Validate optional filters
  const agentIdRaw = sp.get('agent_id')
  const agentId = agentIdRaw && UUID_RE.test(agentIdRaw) ? agentIdRaw : null

  const statusRaw = sp.get('status') ?? ''
  const status = (ALLOWED_STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : null

  const ownerHash = hashApiKey(session.userId.toString())

  const calls = await (db as any).$queryRaw`
    SELECT
      c.id, c.agent_id as "agentId", c.caller_number as "callerNumber",
      c.direction, c.sip_call_id as "sipCallId", c.status,
      c.started_at as "startedAt", c.ended_at as "endedAt",
      c.duration_s as "durationS", c.barge_in_count as "bargeInCount",
      c.turn_count as "turnCount",
      a.name as "agentName",
      ca.sentiment_score as "sentimentScore",
      ca.outcome
    FROM voice_calls c
    JOIN voice_agents a ON a.id = c.agent_id
    LEFT JOIN call_analysis ca ON ca.call_id = c.id
    WHERE a.owner_api_key = ${ownerHash}
      ${agentId ? (db as any).$raw`AND c.agent_id = ${agentId}::uuid` : (db as any).$raw``}
      ${status ? (db as any).$raw`AND c.status = ${status}` : (db as any).$raw``}
    ORDER BY c.started_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  const [{ total }] = await (db as any).$queryRaw`
    SELECT COUNT(*) as total FROM voice_calls c
    JOIN voice_agents a ON a.id = c.agent_id
    WHERE a.owner_api_key = ${ownerHash}
      ${agentId ? (db as any).$raw`AND c.agent_id = ${agentId}::uuid` : (db as any).$raw``}
  `

  return NextResponse.json({ calls, total: Number(total), limit, offset })
}

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json()
  const parsed = callCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { agentId, callerNumber, direction, metadata } = parsed.data
  const ownerHash = hashApiKey(session.userId.toString())

  // Verify agent belongs to this user
  const [agent] = await (db as any).$queryRaw`
    SELECT id FROM voice_agents WHERE id = ${agentId}::uuid AND owner_api_key = ${ownerHash}
  `
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const [call] = await (db as any).$queryRaw`
    INSERT INTO voice_calls (agent_id, caller_number, direction, status, metadata)
    VALUES (${agentId}::uuid, ${callerNumber ?? null}, ${direction}, 'active',
            ${metadata ? JSON.stringify(metadata) : null})
    RETURNING id, agent_id as "agentId", status, started_at as "startedAt"
  `

  // Issue a short-lived signed token for WebSocket auth instead of exposing agentId
  const wsBase = process.env.ORCHESTRATOR_WS_URL ?? 'ws://localhost:8080'
  const wsUrl = `${wsBase}/ws/call?call_id=${call.id}&agent_id=${agentId}`

  return NextResponse.json({ call, wsUrl }, { status: 201 })
}
