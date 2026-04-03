// GET /api/voice/analytics
// Dashboard API: concurrent calls, latency percentiles, barge-in rate,
// conversion rates, and per-agent summaries.
//
// All aggregate stats are computed in a single CTE query to minimise
// round-trips and database load.
//
// Query params:
//   agent_id    – filter to a single agent (optional, must be UUID)
//   from        – ISO start date (default: 24h ago)
//   to          – ISO end date   (default: now)
//   granularity – hour | day     (default: hour)
import { unstable_cache } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { hashApiKey } from '@/lib/voice/auth'
import { analyticsQuerySchema } from '@/lib/voice/validation'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = analyticsQuerySchema.safeParse(sp)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { agent_id: agentId, from, to, granularity } = parsed.data
  const granularityInterval = granularity === 'day' ? '1 day' : '1 hour'
  const ownerHash = hashApiKey(session.userId.toString())

  // Cache per owner+params for 60 seconds to reduce DB load
  const cacheKey = `analytics:${ownerHash}:${agentId ?? ''}:${from}:${to}:${granularity}`
  const getData = unstable_cache(
    async () => fetchAnalytics(ownerHash, agentId ?? null, from, to, granularityInterval),
    [cacheKey],
    { revalidate: 60 }
  )

  const result = await getData()
  return NextResponse.json(result)
}

async function fetchAnalytics(
  ownerHash: string,
  agentId: string | null,
  from: string,
  to: string,
  granularityInterval: string
) {
  // ── Single CTE: compute all dashboard metrics in one round-trip ────────────
  const [summary] = await (db as any).$queryRaw`
    WITH
    -- Active calls
    active AS (
      SELECT COUNT(*) AS active_calls
      FROM voice_calls c
      JOIN voice_agents a ON a.id = c.agent_id
      WHERE a.owner_api_key = ${ownerHash}
        AND c.status = 'active'
    ),
    -- Calls in the requested window
    window_calls AS (
      SELECT c.id, c.agent_id, c.barge_in_count, c.turn_count, c.duration_s
      FROM voice_calls c
      JOIN voice_agents a ON a.id = c.agent_id
      WHERE a.owner_api_key = ${ownerHash}
        AND c.started_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
        ${agentId ? (db as any).$raw`AND c.agent_id = ${agentId}::uuid` : (db as any).$raw``}
    ),
    -- Latency percentiles over window turns
    latency AS (
      SELECT
        AVG(m.ttfb_ms)::FLOAT                                            AS avg_ttfb_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY m.ttfb_ms)::FLOAT  AS p95_ttfb_ms
      FROM call_turn_metrics m
      JOIN window_calls wc ON wc.id = m.call_id
    ),
    -- Barge-in rate
    barge AS (
      SELECT
        ROUND(100.0 * SUM(barge_in_count) / NULLIF(SUM(turn_count), 0), 2)::FLOAT AS barge_in_rate
      FROM window_calls
    ),
    -- Conversion rate (completed calls only)
    conv AS (
      SELECT
        ROUND(100.0 * COUNT(*) FILTER (WHERE ca.outcome IN ('conversion','ftd'))
              / NULLIF(COUNT(*), 0), 2)::FLOAT AS conversion_rate
      FROM window_calls wc
      JOIN voice_calls c ON c.id = wc.id
      LEFT JOIN call_analysis ca ON ca.call_id = wc.id
      WHERE c.status = 'completed'
    ),
    -- Sentiment average
    sentiment AS (
      SELECT ROUND(AVG(ca.sentiment_score)::NUMERIC, 1)::FLOAT AS sentiment_avg
      FROM call_analysis ca
      JOIN window_calls wc ON wc.id = ca.call_id
    ),
    -- Calls today (always last 24h, ignoring window filter)
    today AS (
      SELECT COUNT(*) AS calls_today
      FROM voice_calls c
      JOIN voice_agents a ON a.id = c.agent_id
      WHERE a.owner_api_key = ${ownerHash}
        AND c.started_at >= NOW() - INTERVAL '24 hours'
    )
    SELECT
      (SELECT active_calls  FROM active)::INT       AS "activeCalls",
      (SELECT calls_today   FROM today)::INT        AS "callsToday",
      (SELECT avg_ttfb_ms   FROM latency)           AS "avgTtfbMs",
      (SELECT p95_ttfb_ms   FROM latency)           AS "p95TtfbMs",
      (SELECT barge_in_rate FROM barge)             AS "bargeInRate",
      (SELECT conversion_rate FROM conv)            AS "conversionRate",
      (SELECT sentiment_avg FROM sentiment)         AS "sentimentAvg"
  `

  // ── Time-series latency buckets ───────────────────────────────────────────
  const buckets = await (db as any).$queryRaw`
    SELECT
      time_bucket(${granularityInterval}::interval, m.end_of_speech_at) AS bucket,
      c.agent_id::TEXT                                                    AS "agentId",
      COUNT(*)::INT                                                       AS turns,
      PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY m.ttfb_ms)::FLOAT    AS "p50Ms",
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY m.ttfb_ms)::FLOAT    AS "p95Ms",
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY m.ttfb_ms)::FLOAT    AS "p99Ms",
      AVG(m.ttfb_ms)::FLOAT                                              AS "avgMs"
    FROM call_turn_metrics m
    JOIN voice_calls c ON c.id = m.call_id
    JOIN voice_agents a ON a.id = c.agent_id
    WHERE a.owner_api_key = ${ownerHash}
      AND m.end_of_speech_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
      ${agentId ? (db as any).$raw`AND c.agent_id = ${agentId}::uuid` : (db as any).$raw``}
    GROUP BY bucket, c.agent_id
    ORDER BY bucket ASC
  `

  // ── Per-agent summary ─────────────────────────────────────────────────────
  const agentSummaries = await (db as any).$queryRaw`
    SELECT
      a.id::TEXT                                                              AS "agentId",
      a.name                                                                  AS "agentName",
      COUNT(DISTINCT c.id)::INT                                               AS "totalCalls",
      ROUND(AVG(c.duration_s))::INT                                           AS "avgDurationS",
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY m.ttfb_ms)::FLOAT         AS "p95TtfbMs",
      ROUND(100.0 * COUNT(*) FILTER (WHERE ca.outcome IN ('conversion','ftd'))
            / NULLIF(COUNT(DISTINCT c.id), 0), 2)::FLOAT                     AS "conversionRate",
      ROUND(AVG(ca.sentiment_score)::NUMERIC, 1)::FLOAT                      AS "sentimentAvg",
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

  return {
    stats: {
      activeCalls:    Number(summary?.activeCalls ?? 0),
      callsToday:     Number(summary?.callsToday ?? 0),
      avgTtfbMs:      summary?.avgTtfbMs ?? 0,
      p95TtfbMs:      summary?.p95TtfbMs ?? 0,
      bargeInRate:    Number(summary?.bargeInRate ?? 0),
      conversionRate: Number(summary?.conversionRate ?? 0),
      sentimentAvg:   Number(summary?.sentimentAvg ?? 0),
    },
    buckets,
    agentSummaries,
  }
}
