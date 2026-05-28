/**
 * VoiceOS Agent Worker
 * Pipeline: LiveKit (WebRTC/SIP) → Deepgram STT → Groq LLM → Cartesia TTS → LiveKit
 *
 * Start: node --import tsx/esm agent/worker.ts dev
 * Production: node --import tsx/esm agent/worker.ts start
 */
import { defineAgent, voice, cli, ServerOptions } from '@livekit/agents';
import { STT } from '@livekit/agents-plugin-deepgram';
import { LLM } from '@livekit/agents-plugin-openai';
import { TTS } from '@livekit/agents-plugin-cartesia';
import { createClient } from '@supabase/supabase-js';
import { buildTools } from './tools/index.js';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs';

// Load .env.local from project root (dev) or process.env (production)
const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env.local');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

// ─── Supabase client for worker-side writes (transcript egress) ───────────────
function getSupabaseAdmin() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export default defineAgent({
  entry: async (ctx) => {
    await ctx.connect();

    // ─── Parse room metadata ────────────────────────────────────────────────
    let systemPrompt =
      'You are a helpful, friendly voice assistant. Keep answers short and conversational — 1-3 sentences. Never use markdown, bullet points, or special characters in your responses.';
    let agentName = 'Assistant';
    let voiceId = 'a0e99841-438c-4a64-b679-ae501e7d6091'; // Cartesia "Helpful Woman"
    let voiceEmotion: string | null = null;
    let firstMessage: string | null = null;
    let workspaceId: string | null = null;
    let agentId: string | null = null;

    try {
      const meta = JSON.parse(ctx.room.metadata ?? '{}') as {
        system_prompt?: string;
        agent_name?: string;
        voice_id?: string;
        voice_emotion?: string | null;
        first_message?: string | null;
        workspace_id?: string | null;
      };
      if (meta.system_prompt) systemPrompt = meta.system_prompt;
      if (meta.agent_name) agentName = meta.agent_name;
      if (meta.voice_id) voiceId = meta.voice_id.replace(/^cartesia-/, '');
      if (meta.voice_emotion) voiceEmotion = meta.voice_emotion;
      if (meta.first_message) firstMessage = meta.first_message;
      if (meta.workspace_id) workspaceId = meta.workspace_id;
    } catch { /* use defaults */ }

    // Extract agentId from room name: "agent-{agentId}-{timestamp}"
    const roomName = ctx.room.name ?? '';
    const roomMatch = roomName.match(/^agent-([0-9a-f-]+)-\d+$/i);
    if (roomMatch) agentId = roomMatch[1]!;

    const groqKey = process.env['GROQ_API_KEY'];
    const openaiKey = process.env['OPENAI_API_KEY'];

    // ─── STT: Deepgram nova-3 — low latency, auto language detection ──────────
    const stt = new STT({
      model: 'nova-3',
      language: 'multi',
      detectLanguage: true,
      apiKey: process.env['DEEPGRAM_API_KEY'],
    });

    // ─── LLM: Groq Llama 4 Scout (~200ms TTFT) with OpenAI fallback ──────────
    const lm = new LLM({
      model: groqKey
        ? 'meta-llama/llama-4-scout-17b-16e-instruct'
        : 'gpt-4o-mini',
      apiKey: groqKey ?? openaiKey,
      ...(groqKey ? { baseURL: 'https://api.groq.com/openai/v1' } : {}),
    });

    // ─── TTS: Cartesia sonic-3 with optional emotion ──────────────────────────
    const tts = new TTS({
      model: 'sonic-3',
      voice: voiceId,
      apiKey: process.env['CARTESIA_API_KEY'],
      language: 'en',
      speed: 'normal',
      ...(voiceEmotion ? { emotion: [`${voiceEmotion}:high`] } : {}),
    });

    // ─── Agent: instructions + tools + turn handling ──────────────────────────
    const agent = new voice.Agent({
      instructions: [
        systemPrompt,
        `Your name is ${agentName}. Always respond in the same language the user speaks to you.`,
        'When you use a tool, speak your thinking hedge naturally — do not repeat what the tool already said.',
        'Never mention that you are an AI unless directly asked.',
      ].join('\n\n'),
      stt,
      llm: lm,
      tts,
      tools: buildTools({ enableTransfer: true, enableOrders: false }),
      turnHandling: {
        turnDetection: undefined, // auto-select: realtime_llm → vad → stt
        endpointing: {
          mode: 'dynamic',
          minDelay: 300,  // 300ms — responsive without being jumpy
          maxDelay: 2500, // 2.5s cap for long thoughtful pauses
        },
        interruption: {
          enabled: true,
          minDuration: 200,               // 200ms triggers interruption
          minWords: 0,                    // single syllable is enough
          falseInterruptionTimeout: 1200, // resume fast after false positive
          resumeFalseInterruption: true,
          backchannelBoundary: [600, 2500],
        },
        preemptiveGeneration: {},
      },
    });

    const session = new voice.AgentSession({ stt, llm: lm, tts });

    // ─── Transcript accumulation ──────────────────────────────────────────────
    // We capture both sides of the conversation for post-call analysis.
    const transcriptLines: string[] = [];
    const callStartedAt = Date.now();

    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
      const msg = ev.item;
      if (!msg || typeof msg !== 'object' || !('role' in msg)) return;
      const role = (msg as { role: string }).role;
      const content = (msg as { content?: unknown }).content;
      const text = Array.isArray(content)
        ? content.map((c: unknown) => (typeof c === 'string' ? c : (c as { text?: string })?.text ?? '')).join(' ')
        : typeof content === 'string'
          ? content
          : '';
      if (text.trim()) {
        const speaker = role === 'assistant' ? agentName : 'User';
        transcriptLines.push(`${speaker}: ${text.trim()}`);
      }
    });

    // ─── Session close — write transcript to Supabase ─────────────────────────
    session.on(voice.AgentSessionEventTypes.Close, async () => {
      const supabase = getSupabaseAdmin();
      if (!supabase || !agentId || !workspaceId) return;

      const durationSeconds = Math.round((Date.now() - callStartedAt) / 1000);
      const transcript = transcriptLines.join('\n');

      // Upsert a call record keyed by room name so the webhook can find it.
      // retell_call_id is reused as a generic call-id field for LiveKit rooms.
      await supabase.from('calls').upsert(
        {
          workspace_id: workspaceId,
          agent_id: agentId,
          retell_call_id: roomName, // acts as LiveKit room name identifier
          direction: 'inbound',
          duration_seconds: durationSeconds,
          status: 'completed',
          transcript: transcript || null,
          cost_usd: 0,
        },
        { onConflict: 'retell_call_id', ignoreDuplicates: false }
      );
    });

    await session.start({ agent, room: ctx.room });

    const greeting = firstMessage?.trim() || 'Hello! How can I help you today?';
    await session.say(greeting);
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
cli.runApp(new ServerOptions({
  agent: fileURLToPath(import.meta.url),
  wsURL: process.env['LIVEKIT_URL'] ?? '',
  apiKey: process.env['LIVEKIT_API_KEY'],
  apiSecret: process.env['LIVEKIT_API_SECRET'],
}) as any);
