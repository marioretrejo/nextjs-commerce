/**
 * VoiceOS Agent Worker
 * Pipeline: LiveKit (WebRTC) → Deepgram STT → Groq LLM → Cartesia TTS → LiveKit
 *
 * Start: node --import tsx/esm agent/worker.ts dev
 */
import { defineAgent, voice, cli } from '@livekit/agents';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ServerOptions } = require('@livekit/agents/dist/worker.js') as { ServerOptions: new (opts: Record<string, unknown>) => unknown };
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

    try {
      const meta = JSON.parse(ctx.room.metadata ?? '{}') as {
        system_prompt?: string;
        agent_name?: string;
        voice_id?: string;
        voice_emotion?: string | null;
        first_message?: string;
      };
      if (meta.system_prompt) systemPrompt = meta.system_prompt;
      if (meta.agent_name) agentName = meta.agent_name;
      if (meta.voice_id) {
        // Strip "cartesia-" prefix — Cartesia API uses raw UUIDs
        voiceId = meta.voice_id.replace(/^cartesia-/, '');
      }
      if (meta.voice_emotion) voiceEmotion = meta.voice_emotion;
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

    // LLM: Groq primary (Llama 4 Scout — ultra-fast), OpenAI fallback
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
    });

    const session = new voice.AgentSession({
      stt,
      llm: lm,
      tts,
    });

    await session.start({ agent, room: ctx.room });
    await session.say('Hello! How can I help you today?');
  },
});

cli.runApp(new ServerOptions({
  agent: fileURLToPath(import.meta.url),
  wsURL: process.env['LIVEKIT_URL'] ?? '',
  apiKey: process.env['LIVEKIT_API_KEY'],
  apiSecret: process.env['LIVEKIT_API_SECRET'],
}) as Parameters<typeof cli.runApp>[0]);
