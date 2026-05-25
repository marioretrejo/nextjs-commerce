import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('automation_rules')
    .select('*')
    .eq('agent_id', id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get workspace_id from agent
  const admin = createAdminClient();
  const { data: agent } = await admin.from('agents').select('workspace_id').eq('id', id).single();
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const body = await req.json() as {
    name: string;
    trigger_outcome: string;
    action_type: string;
    action_config?: Record<string, unknown>;
    enabled?: boolean;
  };

  const { data, error } = await admin
    .from('automation_rules')
    .insert({
      agent_id: id,
      workspace_id: agent.workspace_id,
      name: body.name,
      trigger_outcome: body.trigger_outcome,
      action_type: body.action_type,
      action_config: body.action_config ?? {},
      enabled: body.enabled ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { rule_id: string } & Record<string, unknown>;
  const { rule_id, ...updates } = body;
  if (!rule_id) return NextResponse.json({ error: 'rule_id required' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('automation_rules')
    .update(updates)
    .eq('id', rule_id)
    .eq('agent_id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const ruleId = url.searchParams.get('rule_id');
  if (!ruleId) return NextResponse.json({ error: 'rule_id required' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('automation_rules')
    .delete()
    .eq('id', ruleId)
    .eq('agent_id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
