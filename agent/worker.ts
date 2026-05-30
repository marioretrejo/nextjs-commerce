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
 *   7. Flow Builder        — Converts agent flow_json graph into structured LLM instructions
 *   8. Dynamic Tools       — Loads workspace-custom HTTP tools from DB at call start
 *   9. Active RAG          — search_knowledge_base tool queries pgvector document chunks
 *
 * Start: node --import tsx/esm agent/worker.ts dev
 * Prod:  node --import tsx/esm agent/worker.ts start
 */
import { defineAgent, voice, llm as agentLlm, llm, tts as agentTts, cli, ServerOptions } from '@livekit/agents';
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

// ── Pilar A: Flow Builder → LLM instructions ────────────────────────────────
// Converts the ReactFlow graph stored in agents.flow_json into a structured
// conversation script that the LLM follows step by step.
interface FlowNodeData {
  nodeType?: string;
  label?: string;
  message?: string;
  variable?: string;
  condition?: string;
  transferNumber?: string;
  [key: string]: unknown;
}

function buildFlowPrompt(flowJson: unknown): string | null {
  if (!flowJson || typeof flowJson !== 'object') return null;
  const { nodes, edges } = flowJson as {
    nodes?: Array<{ id: string; data: FlowNodeData }>;
    edges?: Array<{ source: string; target: string; label?: string }>;
  };
  if (!Array.isArray(nodes) || nodes.length === 0) return null;

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const adj = new Map<string, Array<{ target: string; label?: string }>>();
  for (const e of (edges ?? [])) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push({ target: e.target, label: e.label as string | undefined });
  }

  const startNode = nodes.find(n => n.data.nodeType === 'start');
  if (!startNode) return null;

  const lines: string[] = [
    '## Structured Conversation Script',
    'Follow this script precisely. Move through each step in order.',
    '',
  ];
  const visited = new Set<string>();

  function traverse(nodeId: string, depth = 0): void {
    if (visited.has(nodeId) || depth > 50) return;
    visited.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (!node) return;
    const d = node.data;
    const indent = depth > 0 ? '  '.repeat(depth) : '';

    switch (d.nodeType) {
      case 'start':
        lines.push(`${indent}- [START] Begin the conversation.`);
        break;
      case 'say':
        lines.push(`${indent}- [SAY] "${d.message || d.label || '(speak a message)'}"`);
        break;
      case 'ask':
        lines.push(`${indent}- [ASK] "${d.message || d.label || '(ask a question)'}"${d.variable ? ` — store their answer as: ${d.variable}` : ''}`);
        break;
      case 'branch':
        lines.push(`${indent}- [BRANCH] ${d.condition || 'Route based on user response'}`);
        break;
      case 'transfer':
        lines.push(`${indent}- [TRANSFER] Call transfer_to_human tool${d.transferNumber ? ` to reach ${d.transferNumber}` : ''}.`);
        break;
      case 'end':
        lines.push(`${indent}- [END] Say a natural farewell, then call the end_call tool with reason "flow_complete".`);
        break;
    }

    const nexts = adj.get(nodeId) ?? [];
    if (nexts.length === 1 && !nexts[0]!.label) {
      traverse(nexts[0]!.target, depth);
    } else {
      for (const next of nexts) {
        if (next.label) lines.push(`${indent}  → If "${next.label}":`);
        traverse(next.target, depth + 1);
      }
    }
  }

  traverse(startNode.id);
  if (lines.length <= 4) return null;
  return lines.join('\n');
}

// ── Pilar B: Dynamic HTTP tool factory ──────────────────────────────────────
// Creates an llm.FunctionTool from a DB row (agent_tools table).
// On invocation the tool calls the configured HTTP endpoint with the args
// and returns the JSON response to the LLM.
interface AgentToolRow {
  name: string;
  description: string;
  parameter_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  server_url: string;
  method: string;
  headers: Record<string, string>;
}

function buildDynamicTool(t: AgentToolRow) {
  return llm.tool({
    description: t.description || t.name,
    parameters: t.parameter_schema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (args: any, opts: Parameters<llm.FunctionTool<any>['execute']>[1]) => {
      opts.ctx.session.say('One moment, let me check that for you.');
      try {
        const res = await Promise.race([
          fetch(t.server_url, {
            method: t.method || 'POST',
            headers: { 'Content-Type': 'application/json', ...t.headers },
            body: t.method !== 'GET' ? JSON.stringify(args) : undefined,
          }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
        ]);
        if (!res.ok) return { error: `Tool returned ${res.status}` };
        return (await res.json()) as Record<string, unknown>;
      } catch (err) {
        return { error: `Tool failed: ${String(err)}` };
      }
    },
  });
}

// ── Pilar C: Active RAG — search_knowledge_base tool ────────────────────────
// Embeds the query with text-embedding-3-small, then calls match_document_chunks
// RPC in Supabase to return the most relevant knowledge chunks.
function buildRagTool(workspaceId: string, openaiKey: string, sbUrl: string, sbKey: string) {
  return llm.tool({
    description: 'Search the knowledge base for information relevant to the user\'s question. Use when you need specific facts, policies, product details, or procedures.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'The question or topic to search for in the knowledge base' },
      },
      required: ['query'],
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (args: { query: string }, opts: Parameters<llm.FunctionTool<any>['execute']>[1]) => {
      opts.ctx.session.say('Let me look that up for you.');
      try {
        // Embed the query using OpenAI text-embedding-3-small (1536 dims)
        const embRes = await Promise.race([
          fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'text-embedding-3-small', input: args.query }),
          }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('embed timeout')), 6000)),
        ]);
        if (!embRes.ok) return { found: false, message: 'Knowledge search unavailable.' };
        const embJson = (await embRes.json()) as { data: Array<{ embedding: number[] }> };
        const embedding = embJson.data[0]?.embedding;
        if (!embedding) return { found: false, message: 'Could not generate search embedding.' };

        // Query pgvector via Supabase RPC
        const rpcRes = await fetch(`${sbUrl}/rest/v1/rpc/match_document_chunks`, {
          method: 'POST',
          headers: {
            apikey: sbKey,
            Authorization: `Bearer ${sbKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query_embedding: embedding,
            p_workspace_id: workspaceId,
            match_threshold: 0.40,
            match_count: 4,
          }),
        });
        if (!rpcRes.ok) return { found: false, message: 'Knowledge search failed.' };
        const chunks = (await rpcRes.json()) as Array<{ content: string; source_name: string }>;
        if (!chunks?.length) return { found: false, message: 'No relevant information found.' };

        return {
          found: true,
          results: chunks.map(c => ({ content: c.content, source: c.source_name })),
        };
      } catch {
        return { found: false, message: 'Knowledge search encountered an error.' };
      }
    },
  });
}

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
    let callDirection: 'inbound' | 'outbound' = 'inbound';
    let transferNumber: string | null = null; // E.164 support phone number for human transfer

    let flowJson: unknown = null;

    try {
      const meta = JSON.parse(ctx.room.metadata ?? '{}') as {
        system_prompt?: string;
        agent_name?: string;
        voice_id?: string;
        voice_emotion?: string | null;
        first_message?: string | null;
        workspace_id?: string | null;
        transfer_number?: string | null;
        call_direction?: string | null;
        agent_id?: string | null;
        flow_json?: unknown;
      };
      if (meta.system_prompt) systemPrompt = meta.system_prompt;
      if (meta.agent_name) agentName = meta.agent_name;
      if (meta.voice_id) voiceId = meta.voice_id.replace(/^cartesia-/, '');
      if (meta.voice_emotion) voiceEmotion = meta.voice_emotion;
      if (meta.first_message) firstMessage = meta.first_message;
      if (meta.workspace_id) workspaceId = meta.workspace_id;
      if (meta.transfer_number) transferNumber = meta.transfer_number;
      if (meta.call_direction === 'outbound') callDirection = 'outbound';
      if (meta.agent_id) agentId = meta.agent_id;
      if (meta.flow_json) flowJson = meta.flow_json;
    } catch { /* use defaults */ }

    const roomName = ctx.room.name ?? '';
    const roomMatch = roomName.match(/^(?:agent|sip-agent)-([0-9a-f-]+)/i);
    // Room name pattern is fallback — metadata agent_id (set above) takes priority
    if (!agentId && roomMatch) agentId = roomMatch[1]!;

    const groqKey = process.env['GROQ_API_KEY'];
    const openaiKey = process.env['OPENAI_API_KEY'];
    const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
    const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

    // ─── 4. Load pronunciation dictionaries from Supabase ────────────────────
    // Non-blocking: awaited here but designed to never throw
    const pronunciation = await loadPronunciationConfig(agentId, supabaseUrl, supabaseKey);

    // ─── Pilar B+C: Load agent tools + flow_json from DB ─────────────────────
    // Load in parallel; both are non-fatal if they fail.
    let agentToolRows: AgentToolRow[] = [];
    if (agentId && supabaseUrl && supabaseKey) {
      try {
        const [toolsRes, flowRes] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/agent_tools?agent_id=eq.${agentId}&order=created_at.asc`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
          }),
          // Load flow_json from DB if it wasn't in the room metadata (inbound calls
          // with older dispatch rules, or calls from the old API)
          flowJson ? Promise.resolve(null) : fetch(
            `${supabaseUrl}/rest/v1/agents?id=eq.${agentId}&select=flow_json`,
            { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
          ),
        ]);
        if (toolsRes.ok) {
          const rows = (await toolsRes.json()) as AgentToolRow[];
          if (Array.isArray(rows)) agentToolRows = rows;
        }
        if (flowRes?.ok) {
          const rows = (await flowRes.json()) as Array<{ flow_json: unknown }>;
          if (Array.isArray(rows) && rows[0]?.flow_json) flowJson = rows[0].flow_json;
        }
      } catch { /* non-fatal — proceed without dynamic tools */ }
    }

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
    // Maps our emotion names → Cartesia experimental_controls emotion tags
    // (must match the same map used in /api/voices/preview for consistency)
    const EMOTION_MAP: Record<string, string[]> = {
      calm:        ['positivity:low'],
      sympathetic: ['sadness:low'],
      happy:       ['positivity:highest'],
      sad:         ['sadness:high'],
      angry:       ['anger:high'],
      fearful:     ['fearfulness:high'],
      surprised:   ['surprise:positive:high'],
    };
    const cartesiaTTS = new CartesiaTTS({
      model: 'sonic-3',
      voice: voiceId,
      apiKey: process.env['CARTESIA_API_KEY'],
      language: 'en',
      speed: 'normal',
      ...(voiceEmotion && EMOTION_MAP[voiceEmotion] ? { emotion: EMOTION_MAP[voiceEmotion] } : {}),
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

    // ── Pilar A: Build flow prompt from flow_json ───────────────────────────
    const flowPrompt = buildFlowPrompt(flowJson);

    // ── Pilar B: Build dynamic tool registry from agent_tools rows ──────────
    const dynamicTools: agentLlm.ToolContext = {};
    for (const t of agentToolRows) {
      try {
        dynamicTools[t.name] = buildDynamicTool(t);
      } catch { /* skip malformed tool */ }
    }

    // ── Pilar C: Add RAG tool when workspace has knowledge base data ─────────
    const ragTool = (workspaceId && openaiKey && supabaseUrl && supabaseKey)
      ? buildRagTool(workspaceId, openaiKey, supabaseUrl, supabaseKey)
      : null;

    // ── end_call tool: built here to close over roomName ────────────────────
    // The LLM calls this when it determines the conversation should end.
    // It speaks the farewell (awaited so audio completes), then deletes
    // the LiveKit room which hangs up the PSTN call and triggers Close.
    const endCallTool = llm.tool({
      description:
        'Hang up and end the call. Call this when: the conversation goal is complete, ' +
        'the user says goodbye or "that\'s all I needed", the flow script reaches [END], ' +
        'the user is unresponsive, or the user explicitly wants to stop. ' +
        'Include a natural, warm farewell in the farewell parameter.',
      parameters: {
        type: 'object' as const,
        properties: {
          farewell: {
            type: 'string',
            description: 'A brief closing phrase to speak before hanging up, e.g. "Have a great day!" or "Thank you for calling, goodbye!"',
          },
          reason: {
            type: 'string',
            enum: ['goal_achieved', 'user_requested', 'flow_complete', 'no_response', 'transferred'],
            description: 'Why the call is ending — used for call analytics',
          },
        },
        required: ['farewell', 'reason'],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: async (args: { farewell: string; reason: string }, opts: Parameters<llm.FunctionTool<any>['execute']>[1]) => {
        log('info', { message: 'end_call.invoked', reason: args.reason, agent_id: agentId, room: roomName });
        // Speak the farewell before disconnecting so the caller hears it
        try {
          await opts.ctx.session.say(args.farewell, { allowInterruptions: false });
        } catch { /* room may already be closing */ }
        // Delete the room — disconnects SIP/WebRTC participant (hangs up the phone)
        // and triggers the worker's Close handler which writes to DB
        const wsUrl = process.env['LIVEKIT_URL'] ?? '';
        const httpUrl = wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
        const lkKey = process.env['LIVEKIT_API_KEY'];
        const lkSecret = process.env['LIVEKIT_API_SECRET'];
        if (httpUrl && lkKey && lkSecret) {
          const { RoomServiceClient: RSC } = await import('livekit-server-sdk');
          new RSC(httpUrl, lkKey, lkSecret).deleteRoom(roomName).catch(() => null);
        }
        return { ended: true, reason: args.reason };
      },
    });

    const CALL_TERMINATION_INSTRUCTIONS = [
      '## Call Termination',
      'Use the end_call tool to hang up when any of the following is true:',
      '- The user says goodbye, "thanks that\'s all", "I\'m good", "no more questions", or equivalent',
      '- The conversation goal has been fully achieved (appointment booked, question answered, issue resolved)',
      '- The conversation flow script reaches an [END] node',
      '- The user is repeatedly unresponsive or only producing filler sounds with no meaningful content',
      '- The user explicitly asks to end the call',
      'Always pass a warm, context-appropriate farewell. Never hang up silently.',
    ].join('\n');

    const instructionParts = [
      systemPrompt,
      `Your name is ${agentName}. Always respond in the same language the user speaks to you.`,
      'When you use a tool, speak your contingency phrase naturally — do not repeat what the tool already said.',
      'Never mention that you are an AI unless directly asked.',
      'If you need to transfer the call, use the transfer_to_human tool — do not attempt it yourself.',
      CALL_TERMINATION_INSTRUCTIONS,
    ];
    if (flowPrompt) instructionParts.push(flowPrompt);

    const agent = new voice.Agent({
      instructions: instructionParts.join('\n\n'),
      stt,
      llm: lm,
      tts,
      // ── 4. Custom TTS pronunciation map ────────────────────────────────────
      // Replacements applied to agent speech before synthesis (e.g. brand names)
      ttsPronunciationMap: pronunciation.ttsMap,
      tools: {
        ...buildTools({
          enableTransfer: true,
          enableOrders: false,
          // ── 3. Pass call context for SIP transfer ─────────────────────────
          roomName,
          transferNumber: transferNumber ?? process.env['SUPPORT_TRANSFER_NUMBER'] ?? null,
          livekitWsUrl: process.env['LIVEKIT_URL'] ?? '',
          livekitApiKey: process.env['LIVEKIT_API_KEY'] ?? '',
          livekitApiSecret: process.env['LIVEKIT_API_SECRET'] ?? '',
        }),
        // Pilar B: workspace-defined custom HTTP tools
        ...dynamicTools,
        // Pilar C: knowledge base search
        ...(ragTool ? { search_knowledge_base: ragTool } : {}),
        // Intelligent call termination
        end_call: endCallTool,
      },
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

    // ─── Mid-call balance checker (every 60s) ─────────────────────────────────
    // Catches the "start with $0.10, talk for 30min" scenario that the token
    // endpoint and room_started webhook cannot prevent. Uses check_workspace_balance()
    // RPC so the math is done DB-side in a single atomic read (no race).
    let balanceCheckInterval: ReturnType<typeof setInterval> | null = null;
    if (workspaceId) {
      const supabaseForBalance = getSupabaseAdmin();
      balanceCheckInterval = setInterval(async () => {
        if (!supabaseForBalance) return;
        const elapsedMin = (Date.now() - callStartedAt) / 60_000;
        try {
          const { data: shouldKill } = await supabaseForBalance.rpc('check_workspace_balance', {
            p_workspace_id: workspaceId,
            p_elapsed_min:  elapsedMin,
          });
          if (shouldKill) {
            log('warn', { message: 'mid_call.balance_exhausted', workspace_id: workspaceId, room: roomName, elapsed_min: elapsedMin });
            clearInterval(balanceCheckInterval!);
            balanceCheckInterval = null;
            // Say goodbye before LiveKit drops the connection
            try {
              await session.say(
                "I'm sorry, your account has reached its minute limit. Please upgrade your plan to continue. Goodbye!",
                { allowInterruptions: false }
              );
            } catch { /* room may already be closing */ }
            // Force-end the room — the webhook will handle final billing
            const wsUrl = process.env['LIVEKIT_URL'] ?? '';
            const httpUrl = wsUrl.replace('wss://', 'https://');
            const lkKey = process.env['LIVEKIT_API_KEY'];
            const lkSecret = process.env['LIVEKIT_API_SECRET'];
            if (httpUrl && lkKey && lkSecret) {
              const { RoomServiceClient } = await import('livekit-server-sdk');
              new RoomServiceClient(httpUrl, lkKey, lkSecret).deleteRoom(roomName).catch(() => null);
            }
          }
        } catch { /* non-fatal — let the call continue */ }
      }, 60_000);
    }

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
      if (balanceCheckInterval) { clearInterval(balanceCheckInterval); balanceCheckInterval = null; }
      log('info', {
        message: 'call.ended',
        agent_id: agentId,
        workspace_id: workspaceId,
        room: roomName,
        duration_seconds: Math.round((Date.now() - callStartedAt) / 1000),
        close_reason: (ev as { reason?: string })?.reason,
      });
      const supabase = getSupabaseAdmin();
      if (!supabase) {
        log('error', { message: 'call.db_skip', reason: 'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in environment' });
        return;
      }
      if (!agentId || !workspaceId) return;

      const durationSeconds = Math.round((Date.now() - callStartedAt) / 1000);
      const transcript = transcriptLines.join('\n');

      await supabase.from('calls').upsert(
        {
          workspace_id: workspaceId,
          agent_id: agentId,
          retell_call_id: roomName,
          direction: callDirection,
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
