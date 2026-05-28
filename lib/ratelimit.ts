/**
 * API rate limiting via Upstash Redis.
 *
 * Per-workspace limits (identified by API key):
 *   - Default: 10 req/s, burst of 50
 *   - Enterprise custom limits stored in workspace `api_rate_limit` column
 *
 * Gracefully degrades (allows all requests) if Redis is not configured.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Singleton clients — created once and reused across Edge invocations
let redis: Redis | null = null;
let defaultRatelimit: Ratelimit | null = null;

function getRedis(): Redis | null {
  if (!process.env['UPSTASH_REDIS_REST_URL'] || !process.env['UPSTASH_REDIS_REST_TOKEN']) {
    return null;
  }
  if (!redis) {
    redis = new Redis({
      url: process.env['UPSTASH_REDIS_REST_URL'],
      token: process.env['UPSTASH_REDIS_REST_TOKEN'],
    });
  }
  return redis;
}

function getDefaultRatelimit(): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  if (!defaultRatelimit) {
    defaultRatelimit = new Ratelimit({
      redis: r,
      // Token bucket: 10 tokens/s, burst up to 50
      limiter: Ratelimit.tokenBucket(10, '1 s', 50),
      prefix: 'voiceos:rl',
    });
  }
  return defaultRatelimit;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp (seconds)
  retryAfter?: number; // seconds
}

/**
 * Check rate limit for a given identifier (workspace_id or api_key prefix).
 * `customLimit` allows Enterprise workspaces to have higher limits (req/s).
 */
export async function checkRateLimit(
  identifier: string,
  customRps?: number
): Promise<RateLimitResult> {
  const r = getRedis();

  // Degrade gracefully — no Redis = allow all
  if (!r) {
    return { allowed: true, limit: 10, remaining: 10, reset: 0 };
  }

  let limiter: Ratelimit;

  if (customRps && customRps !== 10) {
    // Per-workspace custom limiter (not cached as singleton — acceptable for Enterprise minority)
    limiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.tokenBucket(customRps, '1 s', customRps * 5),
      prefix: 'voiceos:rl',
    });
  } else {
    limiter = getDefaultRatelimit()!;
  }

  const result = await limiter.limit(identifier);

  const retryAfter = result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000);

  return {
    allowed: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: Math.floor(result.reset / 1000),
    retryAfter,
  };
}

/**
 * Record a 429 rejection for abuse monitoring.
 * Increments a counter per workspace with a 1-hour TTL.
 * If the counter exceeds `ABUSE_THRESHOLD` within the window,
 * the workspace is flagged for superadmin review.
 */
const ABUSE_THRESHOLD = 100; // rejections per hour

export async function recordRejection(workspaceId: string): Promise<void> {
  const r = getRedis();
  if (!r) return;

  const key = `voiceos:abuse:${workspaceId}`;
  try {
    const count = await r.incr(key);
    if (count === 1) {
      // Set 1-hour expiry on first rejection in the window
      await r.expire(key, 3600);
    }
    // Log to console so server logs capture it — admin dashboard reads Redis directly
    if (count === ABUSE_THRESHOLD) {
      console.warn(`[ratelimit] ABUSE ALERT workspace=${workspaceId} rejections=${count} in last hour`);
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Read current rejection count for a workspace (for admin dashboard).
 * Returns 0 if Redis is unavailable.
 */
export async function getRejectionCount(workspaceId: string): Promise<number> {
  const r = getRedis();
  if (!r) return 0;
  try {
    const val = await r.get<number>(`voiceos:abuse:${workspaceId}`);
    return val ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Read rejection counts for multiple workspaces in one pipeline.
 */
export async function getBulkRejectionCounts(
  workspaceIds: string[]
): Promise<Record<string, number>> {
  const r = getRedis();
  if (!r || workspaceIds.length === 0) return {};

  try {
    const keys = workspaceIds.map(id => `voiceos:abuse:${id}`);
    const pipeline = r.pipeline();
    keys.forEach(k => pipeline.get(k));
    const results = await pipeline.exec<(number | null)[]>();
    return Object.fromEntries(
      workspaceIds.map((id, i) => [id, (results[i] as number | null) ?? 0])
    );
  } catch {
    return {};
  }
}
