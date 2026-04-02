// GET    /api/voice/agents/:id  – fetch a single agent
// PATCH  /api/voice/agents/:id  – update agent configuration
// DELETE /api/voice/agents/:id  – delete agent (and all associated calls)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { hashApiKey } from '@/lib/voice/auth'
import { agentPatchSchema } from '@/lib/voice/validation'

type Params = { params: Promise<{ id: string }> }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(id: string): boolean {
  return UUID_RE.test(id)
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession(_req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ownerHash = hashApiKey(session.userId.toString())

  const [agent] = await (db as any).$queryRaw`
    SELECT id, name, system_prompt as "systemPrompt", llm_model as "llmModel",
           stt_model as "sttModel", tts_provider as "ttsProvider",
           tts_voice_id as "ttsVoiceId", language, silence_timeout_ms as "silenceTimeoutMs",
           max_call_duration_s as "maxCallDurationS", webhook_url as "webhookUrl",
           pinecone_index as "pineconeIndex", metadata, created_at as "createdAt"
    FROM voice_agents
    WHERE id = ${id}::uuid AND owner_api_key = ${ownerHash}
  `

  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ agent })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ownerHash = hashApiKey(session.userId.toString())

  // Parse + validate with zod – no raw user data reaches the query
  const raw = await req.json()
  const parsed = agentPatchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const data = parsed.data
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Build individual parameterised SET clauses — no string interpolation of user data
  const {
    name, systemPrompt, llmModel, sttModel, ttsProvider,
    ttsVoiceId, language, silenceTimeoutMs, maxCallDurationS,
    webhookUrl, pineconeIndex, metadata,
  } = data

  await (db as any).$executeRaw`
    UPDATE voice_agents SET
      name                = COALESCE(${name ?? null}, name),
      system_prompt       = COALESCE(${systemPrompt ?? null}, system_prompt),
      llm_model           = COALESCE(${llmModel ?? null}, llm_model),
      stt_model           = COALESCE(${sttModel ?? null}, stt_model),
      tts_provider        = COALESCE(${ttsProvider ?? null}, tts_provider),
      tts_voice_id        = COALESCE(${ttsVoiceId ?? null}, tts_voice_id),
      language            = COALESCE(${language ?? null}, language),
      silence_timeout_ms  = COALESCE(${silenceTimeoutMs ?? null}, silence_timeout_ms),
      max_call_duration_s = COALESCE(${maxCallDurationS ?? null}, max_call_duration_s),
      webhook_url         = COALESCE(${webhookUrl ?? null}, webhook_url),
      pinecone_index      = COALESCE(${pineconeIndex ?? null}, pinecone_index),
      metadata            = COALESCE(${metadata ? JSON.stringify(metadata) : null}::jsonb, metadata),
      updated_at          = NOW()
    WHERE id = ${id}::uuid AND owner_api_key = ${ownerHash}
  `

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ownerHash = hashApiKey(session.userId.toString())

  await (db as any).$executeRaw`
    DELETE FROM voice_agents
    WHERE id = ${id}::uuid AND owner_api_key = ${ownerHash}
  `

  return NextResponse.json({ success: true })
}
