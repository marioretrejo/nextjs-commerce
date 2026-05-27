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

// Retell voice IDs for Spanish/Latin America as language fallbacks
const LANGUAGE_VOICE_FALLBACK: Record<string, string> = {
  'es': '11labs-Claudia',    // Mexican Spanish, female
  'pt': '11labs-Elli',
  'fr': '11labs-Elli',
  'de': '11labs-Elli',
  'en': '11labs-Elli',
};

const RETELL_VOICE_PREFIXES = ['11labs-', 'openai-', 'cartesia-', 'retell-', 'minimax-', 'fish_audio-', 'qwen3-'];

function resolveRetellVoiceId(voiceId: string | null | undefined, language?: string | null): string {
  // If already a Retell voice ID (new agents from updated picker), use directly
  if (voiceId && RETELL_VOICE_PREFIXES.some((p) => voiceId.startsWith(p))) {
    return voiceId;
  }
  // Fall back to language-appropriate voice
  const langCode = (language ?? 'en').split('-')[0]?.toLowerCase() ?? 'en';
  return LANGUAGE_VOICE_FALLBACK[langCode] ?? '11labs-Elli';
}

function buildVoicemailOption(agent: Partial<Agent>) {
  if (!agent.amd_enabled) return null;
  if (agent.amd_action === 'hangup') return { action: { type: 'hangup' as const } };
  if (agent.amd_action === 'leave_voicemail') {
    const msg = agent.voicemail_message?.trim() || 'Thank you for your time. We\'ll try reaching you again soon.';
    return { action: { type: 'static_text' as const, text: msg } };
  }
  return null;
}

export async function syncAgentToRetell(agentId: string): Promise<string | null> {
  if (!process.env['RETELL_API_KEY']) return null;

  const admin = createAdminClient();
  const { data: raw } = await admin.from('agents').select('*').eq('id', agentId).single();
  if (!raw) return null;
  const agent = raw as unknown as Agent;

  const retellClient = getRetellClient();
  const prompt = agent.system_prompt || buildSystemPrompt(agent);
  const voiceId = resolveRetellVoiceId(agent.voice_id, agent.language);

  const llm = await retellClient.llm.create({
    model: 'gpt-4.1',
    general_prompt: prompt,
    begin_message: agent.first_message ?? undefined,
  });

  const voicemailOption = buildVoicemailOption(agent);

  // Pick voice model based on provider prefix
  const isCartesia = voiceId.startsWith('cartesia-');
  const voiceModel = isCartesia ? 'sonic-3.5' : 'eleven_v3';

  const retellAgent = await retellClient.agent.create({
    agent_name: agent.name,
    response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
    voice_id: voiceId,
    voice_model: voiceModel,
    voice_temperature: 1.0,
    language: (agent.language ?? 'en-US') as 'en-US',
    interruption_sensitivity: agent.interruption_handling ? 0.8 : 0.1,
    enable_backchannel: true,
    voicemail_option: voicemailOption ?? undefined,
    ambient_sound: agent.ambient_sound ?? undefined,
    ambient_sound_volume: agent.ambient_sound != null ? (agent.ambient_sound_volume ?? 1.0) : undefined,
  } as Parameters<typeof retellClient.agent.create>[0]);

  await admin
    .from('agents')
    .update({ retell_agent_id: retellAgent.agent_id })
    .eq('id', agentId);

  return retellAgent.agent_id;
}
