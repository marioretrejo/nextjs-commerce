import { createAdminClient } from '@/lib/supabase/admin';
import { retell } from './client';
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

// Maps ElevenLabs voice names (e.g. "George - Warm, Captivating Storyteller") to
// Retell's 11labs-{Name} format. Falls back to 11labs-Elli if name is blank.
function toRetellVoiceId(voiceName: string | null | undefined): string {
  const base = (voiceName ?? '').split(' - ')[0] ?? '';
  const simple = (base.split(' (')[0] ?? '').trim();
  return simple ? `11labs-${simple}` : '11labs-Elli';
}

export async function syncAgentToRetell(agentId: string): Promise<string | null> {
  if (!process.env['RETELL_API_KEY']) return null;

  const admin = createAdminClient();
  const { data: raw } = await admin.from('agents').select('*').eq('id', agentId).single();
  if (!raw) return null;
  const agent = raw as unknown as Agent;

  const prompt = agent.system_prompt || buildSystemPrompt(agent);

  // Retell rejects variable keys that contain dots — flatten them to underscores
  const rawVars = (agent.dynamic_variables ?? {}) as Record<string, string>;
  const safeVars = Object.fromEntries(
    Object.entries(rawVars).map(([k, v]) => [k.replace(/\./g, '_'), v])
  );

  const llm = await retell.createLLM({
    model: 'gpt-4.1',
    general_prompt: prompt,
    begin_message: agent.first_message ?? undefined,
    ...(Object.keys(safeVars).length > 0 ? { default_dynamic_variables: safeVars } : {}),
  });

  const retellAgent = await retell.createAgent({
    agent_name: agent.name,
    response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
    voice_id: toRetellVoiceId(agent.voice_name),
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
