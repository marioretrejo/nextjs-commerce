import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('agents')
    .select('id, flow_json, flow_config')
    .eq('id', id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const row = data as { flow_json: unknown; flow_config: unknown };
  return NextResponse.json({
    flow_json:   row.flow_json   ?? null,
    flow_config: row.flow_config ?? null,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: agent } = await supabase.from('agents').select('id, workspace_id').eq('id', id).single();
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as { flow_json?: unknown; flow_config?: unknown };
  const update: Record<string, unknown> = {};
  if ('flow_json'   in body) update['flow_json']   = body.flow_json;
  if ('flow_config' in body) update['flow_config'] = body.flow_config;

  const admin = createAdminClient();
  // Scope admin update to both id AND workspace_id to prevent cross-workspace writes
  const agentWorkspaceId = (agent as unknown as { workspace_id: string }).workspace_id;
  const { error } = await admin.from('agents').update(update).eq('id', id).eq('workspace_id', agentWorkspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
