/**
 * VoiceOS Agent Worker — Enterprise Edition
 * Pipeline: LiveKit (WebRTC/SIP) → Deepgram STT → Groq LLM → Cartesia TTS → LiveKit
 *
 * Enterprise features implemented here:
 *   1. PII Redaction       — Deepgram masks card numbers, SSN, numeric PII before logging
 *   2. LLM + TTS Fallbacks — Groq → OpenAI (LLM), Cartesia → OpenAI TTS (automatic)
 *   3. Human Transfer      — SIP REFER via LiveKit when transfer_to_human is invoked
 *   4. Pronunciation Dicts — Custom keywords (Deepgram) + TTS map (Cartesia) from Supabase
 *   5. Backchanneling      — Listening acknowledgments injected during long user speech
 *   6. Filler Suppression  — "uhm", "uh", "er" utterances never trigger premature turn-end
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
import { BackchannelManager, isFillerOnly } from './backchannel.js';
import { startSpan, endSpan, checkLatencyThreshold, log } from '../lib/tracing.js';
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
          // 'dynamic' adjusts the silence threshold based on speech complexity:
          // short answers get a fast 450ms cut-off; long complex thoughts get
          // up to 3 s before the agent treats the pause as a turn-end.
          mode: 'dynamic',
          minDelay: 450,   // was 300ms — extra 150ms prevents cutting off mid-thought pauses
          maxDelay: 3000,  // was 2500ms — gives complex multi-clause sentences more breathing room
        },
        interruption: {
          enabled: true,
          minDuration: 250,  // ignore sub-250ms noises (clicks, breath) as interruptions
          minWords: 1,       // at least one word required — suppresses single-phoneme false triggers
          falseInterruptionTimeout: 1500,
          resumeFalseInterruption: true,
          // backchannelBoundary: agent may emit a listening sound when user speech
          // falls within this ms range (600–3000ms of agent speaking before user interjects)
          backchannelBoundary: [600, 3000],
        },
        preemptiveGeneration: {},
      },
    });

    const session = new voice.AgentSession({ stt, llm: lm, tts });

    // ─── Kill switch: handle graceful disconnect if room is deleted mid-call ──
    // When the webhook detects zero credits, it calls RoomServiceClient.deleteRoom().
    // The worker gets a disconnect signal — say goodbye before the line drops.
    ctx.room.on('disconnected', async () => {
      const reason = (ctx.room as unknown as { disconnectReason?: string }).disconnectReason;
      if (reason === 'ROOM_DELETED' || reason === 'SERVER_SHUTDOWN') {
        try {
          // Best-effort — room may already be gone
          await session.say(
            "I'm sorry, we need to end our call now due to account limits. Please contact support to continue."
          );
        } catch { /* ignore — room is closing */ }
      }
    });

    // ─── Backchanneling: active-listening sounds during long user speech ──────
    // Fires "Mhm.", "I see.", etc. when the user speaks continuously for > 3.2s.
    // Filler-only finals ("uhm", "er", "yeah") are suppressed so they never
    // advance the LLM clock or generate a premature agent response.
    const backchannel = new BackchannelManager(session, 3200, 8000);

    // ─── Distributed tracing: capture pipeline latency per stage ─────────────
    let sttSpan = startSpan('stt');
    let llmSpan = startSpan('llm.first_token');
    let ttsSpan = startSpan('tts.first_chunk');

    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (ev) => {
      const typed = ev as { isFinal?: boolean; transcript?: string };
      const text = typed.transcript ?? '';

      if (!typed.isFinal) {
        // Non-final (partial) transcript — user is still speaking
        backchannel.onPartial();
        return;
      }

      // Final transcript — user finished a thought
      backchannel.onFinal();

      // Suppress filler-only utterances: don't advance spans or log them as
      // real turns — "uh", "hmm", "ok" alone should never trigger a full LLM response.
      if (isFillerOnly(text)) {
        log('info', { message: 'stt.filler_suppressed', text, agent_id: agentId });
        return;
      }

      const result = endSpan(sttSpan, {
        agent_id: agentId,
        workspace_id: workspaceId,
        transcript_chars: text.length,
      });
      checkLatencyThreshold(result);
      sttSpan = startSpan('stt'); // reset for next utterance
      llmSpan = startSpan('llm.first_token'); // start LLM clock
    });

    session.on(voice.AgentSessionEventTypes.SpeechCreated, () => {
      const llmResult = endSpan(llmSpan, { agent_id: agentId });
      checkLatencyThreshold(llmResult);
      llmSpan = startSpan('llm.first_token'); // reset
      ttsSpan = startSpan('tts.first_chunk');  // start TTS clock
    });

    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
      if ((ev as { state?: string }).state === 'speaking') {
        const ttsResult = endSpan(ttsSpan, { agent_id: agentId });
        checkLatencyThreshold(ttsResult);
        ttsSpan = startSpan('tts.first_chunk'); // reset
      }
    });

    // ─── Transcript accumulation ──────────────────────────────────────────────
    const transcriptLines: string[] = [];
    const callStartedAt = Date.now();
    log('info', { message: 'call.started', agent_id: agentId, workspace_id: workspaceId, room: roomName });

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
    session.on(voice.AgentSessionEventTypes.Close, async (ev) => {
      backchannel.destroy();
      log('info', {
        message: 'call.ended',
        agent_id: agentId,
        workspace_id: workspaceId,
        room: roomName,
        duration_seconds: Math.round((Date.now() - callStartedAt) / 1000),
        close_reason: (ev as { reason?: string })?.reason,
      });
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
    });  // end Close handler

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
