import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { syncAgentToRetell } from '@/lib/retell/sync';
import { sanitizeAgentForClient } from '@/lib/sanitize';
import type { Agent } from '@/lib/supabase/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, apiOk, parseBody } from '@/lib/api';

const CreateAgentSchema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  language: z.string().optional(),
  auto_language_detection: z.boolean().optional(),
  voice_engine: z.enum(['retell', 'elevenlabs', 'hybrid', 'standard', 'ultra_fast', 'premium']).optional(),
  voice_id: z.string().optional(),
  voice_name: z.string().optional(),
  emotional_speed: z.number().min(0.5).max(2).optional(),
  emotional_pitch: z.number().min(0.5).max(2).optional(),
  emotional_expressiveness: z.number().min(0).max(1).optional(),
  objective: z.string().optional(),
  personality: z.string().optional(),
  system_prompt: z.string().optional(),
  first_message: z.string().optional(),
  voicemail_message: z.string().optional(),
  schedule_days: z.array(z.string()).optional(),
  schedule_start_time: z.string().optional(),
  schedule_end_time: z.string().optional(),
  timezone: z.string().optional(),
  max_attempts: z.number().int().min(1).max(30).optional(),
  retry_interval_minutes: z.number().int().min(1).optional(),
  phone_number_id: z.string().optional(),
  branded_caller_id: z.string().optional(),
  transfer_enabled: z.boolean().optional(),
  transfer_number: z.string().optional(),
  transfer_type: z.enum(['warm', 'cold']).optional(),
  transfer_condition: z.string().optional(),
  interruption_handling: z.boolean().optional(),
  noise_cancellation: z.boolean().optional(),
  ivr_mode: z.boolean().optional(),
  dtmf_enabled: z.boolean().optional(),
  post_call_analysis_enabled: z.boolean().optional(),
  voice_emotion: z.enum(['calm','sympathetic','happy','sad','angry','fearful','surprised']).nullable().optional(),
  dynamic_variables: z.record(z.unknown()).optional(),
});

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[agents] GET error:', error);
    return apiError('Internal server error', 500);
  }
  return apiOk((data as Record<string, unknown>[]).map(sanitizeAgentForClient));
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = parseBody(CreateAgentSchema, await req.json());
  if (!parsed.success) return parsed.response;
  const body = parsed.data;
  const { workspace_id } = body;

  // Check plan limits
  const { count } = await supabase
    .from('agents')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspace_id);

  const { data: ws } = await supabase.from('workspaces').select('plan').eq('id', workspace_id).single();
  const limits: Record<string, number> = { free: 1, pro: 5, scale: Infinity };
  const plan = (ws as { plan: string } | null)?.plan ?? 'free';
  if ((count ?? 0) >= (limits[plan] ?? 1)) {
    return NextResponse.json({ error: 'Agent limit reached for your plan' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Create in DB first
  const { data: agent, error: dbErr } = await admin
    .from('agents')
    .insert({
      workspace_id,
      name: body.name ?? 'New Agent',
      language: body.language ?? 'en-US',
      auto_language_detection: body.auto_language_detection ?? false,
      voice_engine: body.voice_engine ?? 'retell',
      voice_id: body.voice_id,
      voice_name: body.voice_name,
      emotional_speed: body.emotional_speed ?? 1.0,
      emotional_pitch: body.emotional_pitch ?? 1.0,
      emotional_expressiveness: body.emotional_expressiveness ?? 0.7,
      objective: body.objective,
      personality: body.personality,
      system_prompt: body.system_prompt,
      first_message: body.first_message,
      voicemail_message: body.voicemail_message,
      schedule_days: body.schedule_days ?? ['mon','tue','wed','thu','fri'],
      schedule_start_time: body.schedule_start_time ?? '09:00',
      schedule_end_time: body.schedule_end_time ?? '18:00',
      timezone: body.timezone ?? 'America/New_York',
      max_attempts: body.max_attempts ?? 3,
      retry_interval_minutes: body.retry_interval_minutes ?? 60,
      phone_number_id: body.phone_number_id || null,
      branded_caller_id: body.branded_caller_id,
      transfer_enabled: body.transfer_enabled ?? false,
      transfer_number: body.transfer_number,
      transfer_type: body.transfer_type ?? 'warm',
      transfer_condition: body.transfer_condition,
      interruption_handling: body.interruption_handling ?? true,
      noise_cancellation: body.noise_cancellation ?? true,
      ivr_mode: body.ivr_mode ?? false,
      dtmf_enabled: body.dtmf_enabled ?? false,
      post_call_analysis_enabled: body.post_call_analysis_enabled ?? true,
      voice_emotion: body.voice_emotion ?? null,
      dynamic_variables: body.dynamic_variables ?? {},
      status: 'active'
    })
    .select()
    .single();

  if (dbErr) {
    console.error('[agents] POST insert error:', dbErr);
    return apiError('Internal server error', 500);
  }
  if (!agent) return apiError('Insert failed', 500);

  const agentRow = agent as Agent;

  // Always sync new agents to Retell
  try {
    const retellAgentId = await syncAgentToRetell(agentRow.id);
    if (retellAgentId) agentRow.retell_agent_id = retellAgentId;
  } catch (e) {
    console.error('Retell sync failed (non-fatal):', e);
  }

  return apiOk(sanitizeAgentForClient(agentRow as unknown as Record<string, unknown>), 201);
}
