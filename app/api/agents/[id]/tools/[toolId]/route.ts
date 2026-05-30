/**
 * DELETE /api/agents/[id]/tools/[toolId]
 * PATCH  /api/agents/[id]/tools/[toolId]
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; toolId: string }> }
) {
  const { id, toolId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  // Verify ownership via workspace
  const { data: agent } = await admin
    .from('agents').select('workspace_id').eq('id', id).single();
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: ws } = await admin
    .from('workspaces').select('id').eq('id', (agent as { workspace_id: string }).workspace_id).eq('owner_id', user.id).single();
  if (!ws) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await admin.from('agent_tools').delete().eq('id', toolId).eq('agent_id', id);
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; toolId: string }> }
) {
  const { id, toolId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: agent } = await admin
    .from('agents').select('workspace_id').eq('id', id).single();
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: ws } = await admin
    .from('workspaces').select('id').eq('id', (agent as { workspace_id: string }).workspace_id).eq('owner_id', user.id).single();
  if (!ws) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as Record<string, unknown>;
  const allowed = ['name', 'description', 'parameter_schema', 'server_url', 'method', 'headers'];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const { data: tool, error } = await admin
    .from('agent_tools').update(patch).eq('id', toolId).eq('agent_id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tool });
}
