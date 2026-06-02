/**
 * GET  /api/agents/[id]/call-actions  — list call actions for an agent
 * POST /api/agents/[id]/call-actions  — create a call action
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import type { CallAction } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

const VALID_TRIGGERS = ['pre_call','post_call','on_transfer','on_voicemail','on_converted','on_no_answer','on_error'] as const;
const VALID_TYPES    = ['webhook','sms','email','crm_update'] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: agentId } = await params;

  // Verify the user owns the agent's workspace
  const { data: agent } = await supabase
    .from('agents')
    .select('id, workspace_id')
    .eq('id', agentId)
    .single();
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('call_actions')
    .select('*')
    .eq('agent_id', agentId)
    .order('trigger')
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ actions: data ?? [] });
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
    .from('agents')
    .select('id, workspace_id')
    .eq('id', agentId)
    .single();
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  let body: Partial<CallAction>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.name?.trim())  return NextResponse.json({ error: '"name" is required' }, { status: 400 });
  if (!body.trigger || !(VALID_TRIGGERS as readonly string[]).includes(body.trigger)) {
    return NextResponse.json({ error: `"trigger" must be one of: ${VALID_TRIGGERS.join(', ')}` }, { status: 400 });
  }
  if (!body.type || !(VALID_TYPES as readonly string[]).includes(body.type)) {
    return NextResponse.json({ error: `"type" must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('call_actions')
    .insert({
      workspace_id: (agent as { workspace_id: string }).workspace_id,
      agent_id:     agentId,
      name:         body.name.trim(),
      trigger:      body.trigger,
      type:         body.type,
      config:       body.config ?? {},
      is_active:    body.is_active ?? true,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ action: data }, { status: 201 });
}
