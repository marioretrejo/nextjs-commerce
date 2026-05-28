/**
 * VoiceOS Agent Worker
 * Pipeline: LiveKit (WebRTC) → Deepgram STT → Groq LLM → Cartesia TTS → LiveKit
 *
 * Start: node --import tsx/esm agent/worker.ts dev
 */
import { defineAgent, voice, cli, ServerOptions } from '@livekit/agents';
import { STT } from '@livekit/agents-plugin-deepgram';
import { LLM } from '@livekit/agents-plugin-openai';
import { TTS } from '@livekit/agents-plugin-cartesia';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs';

// Load .env.local from the project root
const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env.local');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

export default defineAgent({
  entry: async (ctx) => {
    await ctx.connect();

    // Agent config is passed as room metadata (set by /api/livekit/token)
    let systemPrompt =
      'You are a helpful, friendly voice assistant. Keep answers short and conversational — 1-3 sentences. Never use markdown, bullet points, or special characters.';
    let agentName = 'Assistant';
    let voiceId = 'a0e99841-438c-4a64-b679-ae501e7d6091'; // Cartesia "Helpful Woman" (English)
    let voiceEmotion: string | null = null;
    let firstMessage: string | null = null;

    try {
      const meta = JSON.parse(ctx.room.metadata ?? '{}') as {
        system_prompt?: string;
        agent_name?: string;
        voice_id?: string;
        voice_emotion?: string | null;
        first_message?: string | null;
      };
      if (meta.system_prompt) systemPrompt = meta.system_prompt;
      if (meta.agent_name) agentName = meta.agent_name;
      if (meta.voice_id) {
        // Strip "cartesia-" prefix — Cartesia API uses raw UUIDs
        voiceId = meta.voice_id.replace(/^cartesia-/, '');
      }
      if (meta.voice_emotion) voiceEmotion = meta.voice_emotion;
      if (meta.first_message) firstMessage = meta.first_message;
    } catch { /* use defaults */ }

    const groqKey = process.env['GROQ_API_KEY'];
    const openaiKey = process.env['OPENAI_API_KEY'];

    // STT: Deepgram nova-3 — low latency, multilingual
    const stt = new STT({
      model: 'nova-3',
      language: 'multi',
      detectLanguage: true,
      apiKey: process.env['DEEPGRAM_API_KEY'],
    });

    // LLM: Groq primary (Llama 4 Scout — ultra-fast ~200ms TTFT), OpenAI fallback
    const lm = new LLM({
      model: groqKey
        ? 'meta-llama/llama-4-scout-17b-16e-instruct'
        : 'gpt-4o-mini',
      apiKey: groqKey ?? openaiKey,
      ...(groqKey ? { baseURL: 'https://api.groq.com/openai/v1' } : {}),
    });

    // TTS: Cartesia sonic-3 with optional emotion
    const tts = new TTS({
      model: 'sonic-3',
      voice: voiceId,
      apiKey: process.env['CARTESIA_API_KEY'],
      language: 'en',
      speed: 'normal',
      ...(voiceEmotion ? { emotion: [`${voiceEmotion}:high`] } : {}),
    });

    const agent = new voice.Agent({
      instructions: `${systemPrompt}\n\nYour name is ${agentName}. Always respond in the same language the user speaks to you.`,
      stt,
      llm: lm,
      tts,
      turnHandling: {
        turnDetection: undefined, // auto-select: realtime_llm → vad → stt
        // Dynamic endpointing adapts to conversation pace — snappy but not premature
        endpointing: {
          mode: 'dynamic',
          minDelay: 300,   // 300ms silence floor — fast but tolerates brief pauses
          maxDelay: 2500,  // 2.5s ceiling — catches long thoughtful pauses
        },
        // Aggressive barge-in: react to even a single syllable
        interruption: {
          enabled: true,
          minDuration: 200,               // 200ms speech to trigger interruption
          minWords: 0,                    // no word-count gate — single syllable is enough
          falseInterruptionTimeout: 1200, // 1.2s before resuming on false positive
          resumeFalseInterruption: true,  // auto-resume if user goes silent after interruption
          // Suppress backchannels ("uh-huh", "yeah") near turn boundaries
          backchannelBoundary: [600, 2500],
        },
        preemptiveGeneration: {}, // use SDK defaults
      },
    });

    const session = new voice.AgentSession({
      stt,
      llm: lm,
      tts,
    });

    await session.start({ agent, room: ctx.room });

    // Use agent-configured greeting if available, otherwise generic
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
