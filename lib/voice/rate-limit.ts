// Sliding-window rate limiter for voice agent API routes.
// Uses an in-process Map for single-instance deployments.
// For multi-replica K8s: swap the store for a Redis-backed implementation.
//
// Usage:
//   const limiter = new RateLimiter()
//   const result = limiter.check(apiKeyHash, limitRpm)
//   if (!result.allowed) return NextResponse.json({ error: 'Too Many Requests' }, {
//     status: 429,
//     headers: { 'Retry-After': String(result.retryAfterSecs) }
//   })

interface WindowEntry {
  count: number
  windowStart: number
}

const WINDOW_MS = 60_000 // 1-minute sliding window

class RateLimiter {
  private store = new Map<string, WindowEntry>()

  /** Returns whether the key is within its per-minute limit. */
  check(key: string, limitRpm: number): { allowed: boolean; retryAfterSecs: number; remaining: number } {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || now - entry.windowStart >= WINDOW_MS) {
      // New window
      this.store.set(key, { count: 1, windowStart: now })
      return { allowed: true, retryAfterSecs: 0, remaining: limitRpm - 1 }
    }

    if (entry.count >= limitRpm) {
      const retryAfterMs = WINDOW_MS - (now - entry.windowStart)
      return {
        allowed: false,
        retryAfterSecs: Math.ceil(retryAfterMs / 1000),
        remaining: 0,
      }
    }

    entry.count++
    return { allowed: true, retryAfterSecs: 0, remaining: limitRpm - entry.count }
  }

  /** Prune stale entries to prevent unbounded memory growth. Call periodically. */
  prune(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now - entry.windowStart >= WINDOW_MS * 2) {
        this.store.delete(key)
      }
    }
  }
}

// Singleton shared across all requests in the same process
export const rateLimiter = new RateLimiter()

// Prune every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => rateLimiter.prune(), 5 * 60_000)
}

/**
 * Enforce rate limiting for a voice API request.
 * Returns a 429 Response if the limit is exceeded, or null if allowed.
 *
 * @param apiKeyHash  SHA-256 hash of the raw API key (never the raw key itself)
 * @param limitRpm    Requests-per-minute allowance for this key (from api_keys table)
 */
export function checkRateLimit(
  apiKeyHash: string,
  limitRpm: number
): { status: 429; headers: Record<string, string> } | null {
  const result = rateLimiter.check(apiKeyHash, limitRpm)
  if (!result.allowed) {
    return {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSecs),
        'X-RateLimit-Limit': String(limitRpm),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil((Date.now() + result.retryAfterSecs * 1000) / 1000)),
      },
    }
  }
  return null
}
