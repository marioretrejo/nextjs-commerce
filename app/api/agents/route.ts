import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { retell } from '@/lib/retell/client';
import type { Agent } from '@/lib/supabase/types';
import { NextResponse } from 'next/server';

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Partial<Agent>;
  const { workspace_id } = body;
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

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
      phone_number_id: body.phone_number_id,
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
      dynamic_variables: body.dynamic_variables ?? {},
      status: 'active'
    })
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  if (!agent) return NextResponse.json({ error: 'Insert failed' }, { status: 500 });

  const agentRow = agent as Agent;

  // Sync to Retell if engine is retell or hybrid
  if ((agentRow.voice_engine === 'retell' || agentRow.voice_engine === 'hybrid') &&
      process.env['RETELL_API_KEY']) {
    try {
      const llm = await retell.createLLM({
        general_prompt: agentRow.system_prompt ?? '',
        begin_message: agentRow.first_message ?? undefined,
        default_dynamic_variables: agentRow.dynamic_variables as Record<string, string>
      });

      const retellAgent = await retell.createAgent({
        agent_name: agentRow.name,
        response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
        voice_id: agentRow.voice_id ?? 'eleven_labs-Elli',
        language: agentRow.language as 'en-US',
        interruption_sensitivity: agentRow.interruption_handling ? 0.8 : 0.1
      });

      await admin
        .from('agents')
        .update({ retell_agent_id: retellAgent.agent_id })
        .eq('id', agentRow.id);

      agentRow.retell_agent_id = retellAgent.agent_id;
    } catch (e) {
      console.error('Retell sync failed:', e);
    }
  }

  return NextResponse.json(agentRow, { status: 201 });
}
