// Voice agent API key authentication.
// API keys are SHA-256 hashed before storage; raw keys are never persisted.
import crypto from 'crypto'
import { NextRequest } from 'next/server'

export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex')
}

export function generateApiKey(): string {
  return 'vk_' + crypto.randomBytes(32).toString('hex')
}

/**
 * Extract and validate the API key from an incoming request.
 * Accepts key via X-API-Key header or ?api_key= query param.
 * Returns the raw key string or null if missing.
 */
export function extractApiKey(req: NextRequest): string | null {
  const header = req.headers.get('x-api-key')
  if (header) return header

  const param = req.nextUrl.searchParams.get('api_key')
  if (param) return param

  return null
}

/**
 * Validate an API key against the database.
 * Returns the user ID associated with the key or null if invalid.
 */
export async function validateVoiceApiKey(
  rawKey: string,
  db: { query: (sql: string, params: unknown[]) => Promise<{ rows: Array<{ user_id: number; is_active: boolean }> }> }
): Promise<number | null> {
  const keyHash = hashApiKey(rawKey)
  const result = await db.query(
    `SELECT user_id, is_active FROM api_keys WHERE key_hash = $1 LIMIT 1`,
    [keyHash]
  )
  if (!result.rows.length || !result.rows[0].is_active) return null

  // Update last_used_at asynchronously
  db.query(`UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1`, [keyHash]).catch(() => {})

  return result.rows[0].user_id
}
