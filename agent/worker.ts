/**
 * VoiceOS Agent Worker — Enterprise Edition
 * Pipeline: LiveKit (WebRTC/SIP) → Deepgram STT → Groq LLM → Cartesia TTS → LiveKit
 *
 * Enterprise features implemented here:
 *   1. PII Redaction       — Deepgram masks card numbers, SSN, numeric PII before logging
 *   2. LLM + TTS Fallbacks — Groq → OpenAI (LLM), Cartesia → OpenAI TTS (automatic)
 *   3. Human Transfer      — SIP REFER via LiveKit when transfer_to_human is invoked
 *   4. Pronunciation Dicts — Custom keywords (Deepgram) + TTS map (Cartesia) from Supabase
 *
 * Start: node --import tsx/esm agent/worker.ts dev
 * Prod:  node --import tsx/esm agent/worker.ts start
 */
import { defineAgent, voice, llm as agentLlm, tts as agentTts, cli, ServerOptions } from '@livekit/agents';
import { STT } from '@livekit/agents-plugin-deepgram';
import { LLM, TTS as OpenAITTS } from '@livekit/agents-plugin-openai';
import { TTS as CartesiaTTS } from '@livekit/agents-plugin-cartesia';
import { createClient } from '@supabase/supabase-js';
import { buildTools } from './tools/index.js';
import { loadPronunciationConfig } from './pronunciation.js';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs';

// Load .env.local from project root in dev; in prod env vars come from the host
const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env.local');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

function getSupabaseAdmin() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export default defineAgent({
  entry: async (ctx) => {
    await ctx.connect();

    // ─── 1. Parse room metadata ───────────────────────────────────────────────
    let systemPrompt =
      'You are a helpful, friendly voice assistant. Keep answers short and conversational — 1-3 sentences. Never use markdown, bullet points, or special characters in your responses.';
    let agentName = 'Assistant';
    let voiceId = 'a0e99841-438c-4a64-b679-ae501e7d6091'; // Cartesia "Helpful Woman"
    let voiceEmotion: string | null = null;
    let firstMessage: string | null = null;
    let workspaceId: string | null = null;
    let agentId: string | null = null;
    let transferNumber: string | null = null; // E.164 support phone number for human transfer

    try {
      const meta = JSON.parse(ctx.room.metadata ?? '{}') as {
        system_prompt?: string;
        agent_name?: string;
        voice_id?: string;
        voice_emotion?: string | null;
        first_message?: string | null;
        workspace_id?: string | null;
        transfer_number?: string | null;
      };
      if (meta.system_prompt) systemPrompt = meta.system_prompt;
      if (meta.agent_name) agentName = meta.agent_name;
      if (meta.voice_id) voiceId = meta.voice_id.replace(/^cartesia-/, '');
      if (meta.voice_emotion) voiceEmotion = meta.voice_emotion;
      if (meta.first_message) firstMessage = meta.first_message;
      if (meta.workspace_id) workspaceId = meta.workspace_id;
      if (meta.transfer_number) transferNumber = meta.transfer_number;
    } catch { /* use defaults */ }

    const roomName = ctx.room.name ?? '';
    const roomMatch = roomName.match(/^(?:agent|sip-agent)-([0-9a-f-]+)/i);
    if (roomMatch) agentId = roomMatch[1]!;

    const groqKey = process.env['GROQ_API_KEY'];
    const openaiKey = process.env['OPENAI_API_KEY'];
    const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
    const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

    // ─── 4. Load pronunciation dictionaries from Supabase ────────────────────
    // Non-blocking: awaited here but designed to never throw
    const pronunciation = await loadPronunciationConfig(agentId, supabaseUrl, supabaseKey);

    // ─── 1. STT: Deepgram nova-3 + PII redaction + custom keywords ───────────
    //
    // redact: 'pci'     → masks credit/debit card numbers
    // redact: 'ssn'     → masks US Social Security Numbers
    // redact: 'numbers' → masks all numeric sequences not otherwise matched
    //
    // Masked values appear as [REDACTED] in the transcript, preventing PII from
    // ever reaching logs, Supabase, or LLM context.
    const stt = new STT({
      model: 'nova-3',
      language: 'multi',
      detectLanguage: true,
      apiKey: process.env['DEEPGRAM_API_KEY'],
      redact: ['pci', 'ssn', 'numbers'],
      keywords:  pronunciation.deepgramKeywords,
      keyterm:   pronunciation.deepgramKeyterms,
    });

    // ─── 2. LLM: Groq primary (~200ms TTFT) → OpenAI gpt-4o-mini fallback ────
    //
    // FallbackAdapter automatically retries on 429 / 5xx / timeout.
    // attemptTimeout: 5s per attempt — switches to OpenAI if Groq doesn't respond
    // maxRetryPerLLM: 1 internal retry before marking the LLM unavailable
    // retryOnChunkSent: false — don't retry if the user already heard partial audio
    const groqLLM = new LLM({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      apiKey: groqKey ?? '',
      baseURL: 'https://api.groq.com/openai/v1',
    });

    const openaiLLM = new LLM({
      model: 'gpt-4o-mini',
      apiKey: openaiKey ?? '',
    });

    const lm = groqKey
      ? new agentLlm.FallbackAdapter({
          llms: [groqLLM, ...(openaiKey ? [openaiLLM] : [])],
          attemptTimeout: 5,
          maxRetryPerLLM: 1,
          retryOnChunkSent: false,
        })
      : openaiLLM;

    // ─── 2. TTS: Cartesia sonic-3 primary → OpenAI TTS fallback ──────────────
    //
    // FallbackAdapter switches to OpenAI TTS if Cartesia returns a network error
    // or times out. maxRetryPerTTS: 2 gives Cartesia two chances before switching.
    // recoveryDelayMs: 5000 re-checks Cartesia every 5s to restore it.
    const cartesiaTTS = new CartesiaTTS({
      model: 'sonic-3',
      voice: voiceId,
      apiKey: process.env['CARTESIA_API_KEY'],
      language: 'en',
      speed: 'normal',
      ...(voiceEmotion ? { emotion: [`${voiceEmotion}:high`] } : {}),
    });

    const tts = openaiKey
      ? new agentTts.FallbackAdapter({
          ttsInstances: [
            cartesiaTTS,
            new OpenAITTS({
              model: 'tts-1',
              voice: 'alloy',
              apiKey: openaiKey,
            }),
          ],
          maxRetryPerTTS: 2,
          recoveryDelayMs: 5000,
        })
      : cartesiaTTS;

    // ─── 3 + 4. Agent: tools (incl. transfer) + TTS pronunciation map ────────
    //
    // ttsPronunciationMap: text replacements applied before Cartesia synthesis.
    // The agent sees the original text in the transcript; only TTS gets the
    // phonetic version — so logs and analysis remain human-readable.
    const agent = new voice.Agent({
      instructions: [
        systemPrompt,
        `Your name is ${agentName}. Always respond in the same language the user speaks to you.`,
        'When you use a tool, speak your contingency phrase naturally — do not repeat what the tool already said.',
        'Never mention that you are an AI unless directly asked.',
        'If you need to transfer the call, use the transfer_to_human tool — do not attempt it yourself.',
      ].join('\n\n'),
      stt,
      llm: lm,
      tts,
      // ── 4. Custom TTS pronunciation map ────────────────────────────────────
      // Replacements applied to agent speech before synthesis (e.g. brand names)
      ttsPronunciationMap: pronunciation.ttsMap,
      tools: buildTools({
        enableTransfer: true,
        enableOrders: false,
        // ── 3. Pass call context for SIP transfer ───────────────────────────
        roomName,
        transferNumber: transferNumber ?? process.env['SUPPORT_TRANSFER_NUMBER'] ?? null,
        livekitWsUrl: process.env['LIVEKIT_URL'] ?? '',
        livekitApiKey: process.env['LIVEKIT_API_KEY'] ?? '',
        livekitApiSecret: process.env['LIVEKIT_API_SECRET'] ?? '',
      }),
      turnHandling: {
        turnDetection: undefined,
        endpointing: {
          mode: 'dynamic',
          minDelay: 300,
          maxDelay: 2500,
        },
        interruption: {
          enabled: true,
          minDuration: 200,
          minWords: 0,
          falseInterruptionTimeout: 1200,
          resumeFalseInterruption: true,
          backchannelBoundary: [600, 2500],
        },
        preemptiveGeneration: {},
      },
    });

    const session = new voice.AgentSession({ stt, llm: lm, tts });

    // ─── Transcript accumulation ──────────────────────────────────────────────
    const transcriptLines: string[] = [];
    const callStartedAt = Date.now();

    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
      const msg = ev.item;
      if (!msg || typeof msg !== 'object' || !('role' in msg)) return;
      const role = (msg as { role: string }).role;
      const content = (msg as { content?: unknown }).content;
      const text = Array.isArray(content)
        ? content.map((c: unknown) =>
            typeof c === 'string' ? c : (c as { text?: string })?.text ?? ''
          ).join(' ')
        : typeof content === 'string'
          ? content
          : '';
      if (text.trim()) {
        const speaker = role === 'assistant' ? agentName : 'User';
        transcriptLines.push(`${speaker}: ${text.trim()}`);
      }
    });

    // ─── Session close — write transcript + duration to Supabase ─────────────
    session.on(voice.AgentSessionEventTypes.Close, async () => {
      const supabase = getSupabaseAdmin();
      if (!supabase || !agentId || !workspaceId) return;

      const durationSeconds = Math.round((Date.now() - callStartedAt) / 1000);
      const transcript = transcriptLines.join('\n');

      await supabase.from('calls').upsert(
        {
          workspace_id: workspaceId,
          agent_id: agentId,
          retell_call_id: roomName,
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
