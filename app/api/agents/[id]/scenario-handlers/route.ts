/**
 * GET  /api/agents/[id]/scenario-handlers  — list scenario configs for an agent
 * POST /api/agents/[id]/scenario-handlers  — create or upsert a scenario handler
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import type { ScenarioHandlerRow } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

const VALID_SCENARIOS = [
  'voicemail_short','voicemail_long','bot_detected',
  'disinterest','objection','no_response','human_requested',
] as const;

const VALID_ACTIONS = [
  'hangup','leave_voicemail','navigate_ivr',
  'transfer','retry_later','custom_response',
] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: agentId } = await params;
  const { data: agent } = await supabase
    .from('agents').select('id').eq('id', agentId).single();
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('scenario_handlers')
    .select('*')
    .eq('agent_id', agentId)
    .order('scenario');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ handlers: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: agentId } = await params;
  const { data: agent } = await supabase
    .from('agents').select('id, workspace_id').eq('id', agentId).single();
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  let body: Partial<ScenarioHandlerRow>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.scenario || !(VALID_SCENARIOS as readonly string[]).includes(body.scenario)) {
    return NextResponse.json({ error: `"scenario" must be one of: ${VALID_SCENARIOS.join(', ')}` }, { status: 400 });
  }
  if (!body.action || !(VALID_ACTIONS as readonly string[]).includes(body.action)) {
    return NextResponse.json({ error: `"action" must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('scenario_handlers')
    .upsert(
      {
        workspace_id: (agent as { workspace_id: string }).workspace_id,
        agent_id:     agentId,
        scenario:     body.scenario,
        action:       body.action,
        config:       body.config ?? {},
        max_attempts: body.max_attempts ?? 4,
        is_active:    body.is_active ?? true,
      },
      { onConflict: 'agent_id,scenario' }
    )
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ handler: data }, { status: 201 });
}
