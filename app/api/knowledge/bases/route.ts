/**
 * GET  /api/knowledge/bases  → list knowledge bases for current workspace
 * POST /api/knowledge/bases  → create a new knowledge base
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

async function getWorkspaceId(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .single();
  return (data as { id: string } | null)?.id ?? null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = await getWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json([], { status: 200 });

  const admin = createAdminClient();
  const { data: kbs } = await admin
    .from('knowledge_bases')
    .select('id, name, description, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  // Attach chunk counts
  const kbIds = (kbs ?? []).map((k) => (k as { id: string }).id);
  if (!kbIds.length) return NextResponse.json([]);

  const { data: counts } = await admin
    .from('document_chunks')
    .select('kb_id')
    .in('kb_id', kbIds);

  const countMap: Record<string, number> = {};
  for (const row of counts ?? []) {
    const id = (row as { kb_id: string }).kb_id;
    countMap[id] = (countMap[id] ?? 0) + 1;
  }

  return NextResponse.json(
    (kbs ?? []).map((kb) => ({
      ...(kb as object),
      chunk_count: countMap[(kb as { id: string }).id] ?? 0,
    }))
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = await getWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const body = await req.json() as { name?: string; description?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('knowledge_bases')
    .insert({ workspace_id: workspaceId, name: body.name.trim(), description: body.description ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const admin = createAdminClient();
  const workspaceId = await getWorkspaceId(user.id);
  const { error } = await admin
    .from('knowledge_bases')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId ?? '');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
