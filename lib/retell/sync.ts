'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getRetellClient } from './client';
import type { Agent } from '@/lib/supabase/types';

function buildSystemPrompt(agent: Partial<Agent>): string {
  const parts: string[] = [];
  if (agent.name) parts.push(`Your name is ${agent.name}.`);
  if (agent.objective) parts.push(`Your objective is to ${agent.objective}.`);
  if (agent.personality) parts.push(`Your personality: ${agent.personality}.`);
  if (agent.transfer_enabled === true && agent.transfer_number) {
    parts.push(`If the customer asks to speak with a human or supervisor, transfer them to ${agent.transfer_number}.`);
  }
  return parts.length > 0 ? parts.join(' ') : 'You are a helpful voice assistant.';
}

// Map ElevenLabs voice names to Retell's catalog.
// Only voices confirmed in Retell's catalog are listed — others fall back by language.
const RETELL_VOICE_MAP: Record<string, string> = {
  // English
  'bella': '11labs-Bella', 'rachel': '11labs-Rachel', 'elli': '11labs-Elli',
  'josh': '11labs-Josh', 'arnold': '11labs-Arnold', 'adam': '11labs-Adam',
  'sam': '11labs-Sam', 'brian': '11labs-Brian', 'kate': '11labs-Kate',
  'lily': '11labs-Lily', 'anna': '11labs-Anna', 'julia': '11labs-Julia',
  'grace': '11labs-Grace', 'chloe': '11labs-Chloe', 'max': '11labs-Max',
  'ethan': '11labs-Ethan', 'noah': '11labs-Noah', 'paul': '11labs-Paul',
  'jessica': '11labs-Jessica', 'george': '11labs-George',
  // Spanish / Latin America
  'hailey': '11labs-Hailey-Latin-America-Spanish-localized',
  'gaby': '11labs-Gaby',
  'isabel': 'cartesia-Isabel',
  'santiago': 'openai-Santiago',
};

const LANGUAGE_VOICE_FALLBACK: Record<string, string> = {
  'es': '11labs-Hailey-Latin-America-Spanish-localized',
  'pt': '11labs-Elli',
  'fr': '11labs-Elli',
  'de': '11labs-Elli',
  'en': '11labs-Elli',
};

function toRetellVoiceId(voiceName: string | null | undefined, language?: string | null): string {
  const base = (voiceName ?? '').split(' - ')[0] ?? '';
  const simple = (base.split(' (')[0] ?? '').trim().toLowerCase();

  if (simple && RETELL_VOICE_MAP[simple]) {
    return RETELL_VOICE_MAP[simple]!;
  }

  // Fall back to language-appropriate voice
  const langCode = (language ?? 'en').split('-')[0]?.toLowerCase() ?? 'en';
  return LANGUAGE_VOICE_FALLBACK[langCode] ?? '11labs-Elli';
}

export async function syncAgentToRetell(agentId: string): Promise<string | null> {
  if (!process.env['RETELL_API_KEY']) return null;

  const admin = createAdminClient();
  const { data: raw } = await admin.from('agents').select('*').eq('id', agentId).single();
  if (!raw) return null;
  const agent = raw as unknown as Agent;

  const retellClient = getRetellClient();
  const prompt = agent.system_prompt || buildSystemPrompt(agent);

  const llm = await retellClient.llm.create({
    model: 'gpt-4.1',
    general_prompt: prompt,
    begin_message: agent.first_message ?? undefined,
  });

  const retellAgent = await retellClient.agent.create({
    agent_name: agent.name,
    response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
    voice_id: toRetellVoiceId(agent.voice_name, agent.language),
    language: (agent.language ?? 'en-US') as 'en-US',
    interruption_sensitivity: agent.interruption_handling ? 0.8 : 0.1,
    enable_backchannel: true,
  });

  await admin
    .from('agents')
    .update({ retell_agent_id: retellAgent.agent_id })
    .eq('id', agentId);

  return retellAgent.agent_id;
}
