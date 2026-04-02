// GET    /api/voice/agents/:id  – fetch a single agent
// PATCH  /api/voice/agents/:id  – update agent configuration
// DELETE /api/voice/agents/:id  – delete agent (and all associated calls)
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { hashApiKey } from '@/lib/voice/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession(_req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
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
  const ownerHash = hashApiKey(session.userId.toString())
  const body = await req.json()

  const allowed = [
    'name', 'systemPrompt', 'llmModel', 'sttModel', 'ttsProvider',
    'ttsVoiceId', 'language', 'silenceTimeoutMs', 'maxCallDurationS',
    'webhookUrl', 'pineconeIndex', 'metadata',
  ]

  const updates = Object.entries(body)
    .filter(([k]) => allowed.includes(k))
    .map(([k, v]) => {
      const col = k.replace(/([A-Z])/g, '_$1').toLowerCase()
      return `${col} = '${v}'`
    })
    .join(', ')

  if (!updates) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })

  await (db as any).$executeRawUnsafe(`
    UPDATE voice_agents
    SET ${updates}, updated_at = NOW()
    WHERE id = '${id}' AND owner_api_key = '${ownerHash}'
  `)

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const ownerHash = hashApiKey(session.userId.toString())

  await (db as any).$executeRaw`
    DELETE FROM voice_agents
    WHERE id = ${id}::uuid AND owner_api_key = ${ownerHash}
  `

  return NextResponse.json({ success: true })
}
