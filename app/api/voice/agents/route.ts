// GET  /api/voice/agents        – list agents for the authenticated user
// POST /api/voice/agents        – create a new agent
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateApiKey, hashApiKey } from '@/lib/voice/auth'
import type { VoiceAgent } from '@/lib/voice/types'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const agents = await (db as any).$queryRaw<VoiceAgent[]>`
    SELECT
      id, name, llm_model as "llmModel", stt_model as "sttModel",
      tts_provider as "ttsProvider", tts_voice_id as "ttsVoiceId",
      language, silence_timeout_ms as "silenceTimeoutMs",
      max_call_duration_s as "maxCallDurationS",
      webhook_url as "webhookUrl", pinecone_index as "pineconeIndex",
      metadata, created_at as "createdAt", updated_at as "updatedAt"
    FROM voice_agents
    WHERE owner_api_key = ${hashApiKey(session.userId.toString())}
    ORDER BY created_at DESC
  `

  return NextResponse.json({ agents })
}

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    name,
    systemPrompt,
    llmModel = 'gpt-4o',
    sttModel = 'nova-2',
    ttsProvider = 'elevenlabs',
    ttsVoiceId,
    language = 'en-US',
    silenceTimeoutMs = 1000,
    maxCallDurationS = 3600,
    webhookUrl,
    pineconeIndex,
    metadata,
  } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Agent name is required' }, { status: 400 })
  }

  // Generate a unique agent-scoped API key
  const rawKey = generateApiKey()
  const keyHash = hashApiKey(rawKey)

  const [agent] = await (db as any).$queryRaw<VoiceAgent[]>`
    INSERT INTO voice_agents (
      name, owner_api_key, system_prompt, llm_model, stt_model,
      tts_provider, tts_voice_id, language, silence_timeout_ms,
      max_call_duration_s, webhook_url, pinecone_index, metadata
    ) VALUES (
      ${name}, ${keyHash}, ${systemPrompt ?? null}, ${llmModel}, ${sttModel},
      ${ttsProvider}, ${ttsVoiceId ?? null}, ${language}, ${silenceTimeoutMs},
      ${maxCallDurationS}, ${webhookUrl ?? null}, ${pineconeIndex ?? null},
      ${metadata ? JSON.stringify(metadata) : null}
    )
    RETURNING id, name, llm_model as "llmModel", created_at as "createdAt"
  `

  // Store the key hash in api_keys table linked to the session user
  await (db as any).$executeRaw`
    INSERT INTO api_keys (key_hash, label, user_id)
    VALUES (${keyHash}, ${'agent:' + name}, ${session.userId})
  `

  return NextResponse.json(
    { agent, apiKey: rawKey }, // raw key returned ONCE; never stored
    { status: 201 }
  )
}
