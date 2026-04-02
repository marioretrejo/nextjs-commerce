// GET /api/voice/analytics
// Dashboard API: concurrent calls, latency percentiles, barge-in rate,
// conversion rates, and per-agent summaries.
//
// Query params:
//   agent_id  – filter to a single agent (optional)
//   from      – ISO start date (default: 24h ago)
//   to        – ISO end date   (default: now)
//   granularity – hour | day   (default: hour)
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { hashApiKey } from '@/lib/voice/auth'
import type { DashboardStats, LatencyBucket } from '@/lib/voice/types'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const agentId = searchParams.get('agent_id')
  const from = searchParams.get('from') ?? new Date(Date.now() - 86_400_000).toISOString()
  const to = searchParams.get('to') ?? new Date().toISOString()
  const granularity = searchParams.get('granularity') === 'day' ? '1 day' : '1 hour'

  const ownerHash = hashApiKey(session.userId.toString())

  // ── Active call count ───────────────────────────────────────────────────────
  const [{ activeCalls }] = await (db as any).$queryRaw`
    SELECT COUNT(*) as "activeCalls"
    FROM voice_calls c
    JOIN voice_agents a ON a.id = c.agent_id
    WHERE a.owner_api_key = ${ownerHash}
      AND c.status = 'active'
  `

  // ── Calls today ─────────────────────────────────────────────────────────────
  const [{ callsToday }] = await (db as any).$queryRaw`
    SELECT COUNT(*) as "callsToday"
    FROM voice_calls c
    JOIN voice_agents a ON a.id = c.agent_id
    WHERE a.owner_api_key = ${ownerHash}
      AND c.started_at >= NOW() - INTERVAL '24 hours'
  `

  // ── Latency stats (P95 TTFB) ─────────────────────────────────────────────────
  const [latencyStats] = await (db as any).$queryRaw`
    SELECT
      AVG(m.ttfb_ms)::FLOAT                                      AS "avgTtfbMs",
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY m.ttfb_ms)::FLOAT AS "p95TtfbMs"
    FROM call_turn_metrics m
    JOIN voice_calls c ON c.id = m.call_id
    JOIN voice_agents a ON a.id = c.agent_id
    WHERE a.owner_api_key = ${ownerHash}
      AND m.end_of_speech_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
      ${agentId ? (db as any).$raw`AND c.agent_id = ${agentId}::uuid` : (db as any).$raw``}
  `

  // ── Barge-in rate ────────────────────────────────────────────────────────────
  const [{ bargeInRate }] = await (db as any).$queryRaw`
    SELECT
      CASE WHEN SUM(turn_count) = 0 THEN 0
           ELSE ROUND(100.0 * SUM(barge_in_count) / NULLIF(SUM(turn_count),0), 2)
      END AS "bargeInRate"
    FROM voice_calls c
    JOIN voice_agents a ON a.id = c.agent_id
    WHERE a.owner_api_key = ${ownerHash}
      AND c.started_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
  `

  // ── Conversion rate ──────────────────────────────────────────────────────────
  const [{ conversionRate }] = await (db as any).$queryRaw`
    SELECT
      ROUND(100.0 * COUNT(*) FILTER (WHERE ca.outcome IN ('conversion','ftd'))
            / NULLIF(COUNT(*), 0), 2) AS "conversionRate"
    FROM voice_calls c
    JOIN voice_agents a ON a.id = c.agent_id
    LEFT JOIN call_analysis ca ON ca.call_id = c.id
    WHERE a.owner_api_key = ${ownerHash}
      AND c.status = 'completed'
      AND c.started_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
  `

  // ── Average sentiment ────────────────────────────────────────────────────────
  const [{ sentimentAvg }] = await (db as any).$queryRaw`
    SELECT ROUND(AVG(ca.sentiment_score)::NUMERIC, 1)::FLOAT AS "sentimentAvg"
    FROM call_analysis ca
    JOIN voice_calls c ON c.id = ca.call_id
    JOIN voice_agents a ON a.id = c.agent_id
    WHERE a.owner_api_key = ${ownerHash}
      AND c.started_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
  `

  const stats: DashboardStats = {
    activeCalls: Number(activeCalls),
    callsToday: Number(callsToday),
    avgTtfbMs: latencyStats?.avgTtfbMs ?? 0,
    p95TtfbMs: latencyStats?.p95TtfbMs ?? 0,
    bargeInRate: Number(bargeInRate ?? 0),
    conversionRate: Number(conversionRate ?? 0),
    sentimentAvg: Number(sentimentAvg ?? 0),
  }

  // ── Time-series latency buckets ───────────────────────────────────────────────
  const buckets: LatencyBucket[] = await (db as any).$queryRaw`
    SELECT
      time_bucket(${granularity}::interval, m.end_of_speech_at) AS bucket,
      c.agent_id::TEXT                                            AS "agentId",
      COUNT(*)::INT                                               AS turns,
      PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY m.ttfb_ms)::FLOAT AS "p50Ms",
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY m.ttfb_ms)::FLOAT AS "p95Ms",
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY m.ttfb_ms)::FLOAT AS "p99Ms",
      AVG(m.ttfb_ms)::FLOAT                                       AS "avgMs"
    FROM call_turn_metrics m
    JOIN voice_calls c ON c.id = m.call_id
    JOIN voice_agents a ON a.id = c.agent_id
    WHERE a.owner_api_key = ${ownerHash}
      AND m.end_of_speech_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
      ${agentId ? (db as any).$raw`AND c.agent_id = ${agentId}::uuid` : (db as any).$raw``}
    GROUP BY bucket, c.agent_id
    ORDER BY bucket ASC
  `

  // ── Per-agent summary ─────────────────────────────────────────────────────────
  const agentSummaries = await (db as any).$queryRaw`
    SELECT
      a.id::TEXT                                            AS "agentId",
      a.name                                                AS "agentName",
      COUNT(DISTINCT c.id)::INT                             AS "totalCalls",
      ROUND(AVG(c.duration_s))::INT                         AS "avgDurationS",
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY m.ttfb_ms)::FLOAT AS "p95TtfbMs",
      ROUND(100.0 * COUNT(*) FILTER (WHERE ca.outcome IN ('conversion','ftd'))
            / NULLIF(COUNT(DISTINCT c.id), 0), 2)::FLOAT   AS "conversionRate",
      ROUND(AVG(ca.sentiment_score)::NUMERIC, 1)::FLOAT     AS "sentimentAvg",
      ROUND(100.0 * SUM(c.barge_in_count) / NULLIF(SUM(c.turn_count), 0), 2)::FLOAT AS "bargeInRate"
    FROM voice_agents a
    LEFT JOIN voice_calls c ON c.agent_id = a.id
      AND c.started_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
    LEFT JOIN call_turn_metrics m ON m.call_id = c.id
    LEFT JOIN call_analysis ca ON ca.call_id = c.id
    WHERE a.owner_api_key = ${ownerHash}
    GROUP BY a.id, a.name
    ORDER BY "totalCalls" DESC
  `

  return NextResponse.json({ stats, buckets, agentSummaries })
}
