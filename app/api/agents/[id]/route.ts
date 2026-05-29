import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sanitizeAgentForClient } from '@/lib/sanitize';
import type { Agent } from '@/lib/supabase/types';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/** Verify the authenticated user owns the workspace that contains this agent.
 *  Uses admin client to bypass RLS (mirrors the edit-page's admin fallback),
 *  then checks workspace ownership via the user-scoped client. */
async function verifyOwnership(
  agentId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ agentRow: Record<string, unknown> } | { error: NextResponse }> {
  const { data: agentRow } = await admin
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();
  if (!agentRow) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  const { data: ws } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', (await supabase.auth.getUser()).data.user!.id)
    .eq('id', (agentRow as Record<string, unknown>)['workspace_id'] as string)
    .single();
  if (!ws) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return { agentRow: agentRow as Record<string, unknown> };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const result = await verifyOwnership(id, supabase, admin);
  if ('error' in result) return result.error;
  return NextResponse.json(sanitizeAgentForClient(result.agentRow));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const ownership = await verifyOwnership(id, supabase, admin);
  if ('error' in ownership) return ownership.error;

  const body = await req.json() as Partial<Agent>;

  // Strip immutable/system fields that must never be overwritten by user input.
  // Sending id/created_at/total_calls etc. in a Supabase UPDATE can cause
  // PostgREST to silently skip or partially reject the update.
  const {
    id: _id,
    workspace_id: _ws,
    retell_agent_id: _rid,
    elevenlabs_agent_id: _eid,
    created_at: _ca,
    total_calls: _tc,
    avg_qa_score: _qa,
    ...safeBody
  } = body as Record<string, unknown>;
  void _id; void _ws; void _rid; void _eid; void _ca; void _tc; void _qa;

  const { data, error } = await admin
    .from('agents')
    .update(safeBody)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const agent = data as Agent;

  revalidatePath('/agents');
  revalidatePath(`/agents/${id}`);
  return NextResponse.json(sanitizeAgentForClient(agent as unknown as Record<string, unknown>));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const ownership = await verifyOwnership(id, supabase, admin);
  if ('error' in ownership) return ownership.error;

  const { error } = await admin.from('agents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
