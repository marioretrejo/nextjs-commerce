// Zod schemas for all voice agent API input validation.
// Import these in route handlers to parse + validate before touching the DB.
import { z } from 'zod'

const ALLOWED_LLM_MODELS = ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'groq-llama-3'] as const
const ALLOWED_STT_MODELS = ['nova-2', 'nova', 'enhanced', 'base'] as const
const ALLOWED_TTS_PROVIDERS = ['elevenlabs', 'cartesia'] as const
const ALLOWED_LANGUAGES = ['en-US', 'en-GB', 'es-ES', 'es-MX', 'pt-BR', 'fr-FR', 'de-DE', 'it-IT', 'ja-JP', 'zh-CN'] as const

// Accepts HTTPS URLs only; rejects localhost and RFC-1918 ranges
const httpsUrl = z
  .string()
  .url()
  .refine((u) => u.startsWith('https://'), 'URL must use HTTPS')
  .refine((u) => {
    try {
      const { hostname } = new URL(u)
      // Block localhost, loopback, and private IP ranges
      const blocked = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1)/.test(hostname)
      return !blocked
    } catch {
      return false
    }
  }, 'URL must not point to a private or loopback address')

// ── Agent schemas ─────────────────────────────────────────────────────────────

export const agentCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  systemPrompt: z.string().max(8000).optional(),
  llmModel: z.enum(ALLOWED_LLM_MODELS).default('gpt-4o'),
  sttModel: z.enum(ALLOWED_STT_MODELS).default('nova-2'),
  ttsProvider: z.enum(ALLOWED_TTS_PROVIDERS).default('elevenlabs'),
  ttsVoiceId: z.string().max(128).optional(),
  language: z.enum(ALLOWED_LANGUAGES).default('en-US'),
  silenceTimeoutMs: z.number().int().min(100).max(30_000).default(1000),
  maxCallDurationS: z.number().int().min(60).max(86_400).default(3600),
  webhookUrl: httpsUrl.optional(),
  pineconeIndex: z.string().max(128).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const agentPatchSchema = agentCreateSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'At least one field must be provided')

// ── Call schemas ──────────────────────────────────────────────────────────────

const UUID = z.string().uuid()

export const callCreateSchema = z.object({
  agentId: UUID,
  callerNumber: z.string().max(32).optional(),
  direction: z.enum(['inbound', 'outbound']).default('outbound'),
  metadata: z.record(z.unknown()).optional(),
})

// ── Analytics query params ────────────────────────────────────────────────────

export const analyticsQuerySchema = z.object({
  agent_id: UUID.optional(),
  from: z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return new Date(Date.now() - 86_400_000).toISOString()
      const d = new Date(s)
      if (isNaN(d.getTime())) throw new Error('Invalid from date')
      return d.toISOString()
    }),
  to: z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return new Date().toISOString()
      const d = new Date(s)
      if (isNaN(d.getTime())) throw new Error('Invalid to date')
      return d.toISOString()
    }),
  granularity: z.enum(['hour', 'day']).default('hour'),
})

export const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((s) => Math.min(parseInt(s ?? '50', 10) || 50, 200)),
  offset: z
    .string()
    .optional()
    .transform((s) => Math.max(0, parseInt(s ?? '0', 10) || 0)),
})
