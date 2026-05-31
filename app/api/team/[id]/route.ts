import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { role?: string; visible_modules?: string[] };

  // Load target member (RLS ensures same workspace)
  const { data: target } = await supabase
    .from('workspace_members')
    .select('id, workspace_id, role, user_id')
    .eq('id', id)
    .single();
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const t = target as { id: string; workspace_id: string; role: string; user_id: string | null };

  // Resolve actor weight
  const { data: profile } = await supabase.from('users').select('is_superadmin').eq('id', user.id).single();
  const isSuperadmin = (profile as { is_superadmin: boolean } | null)?.is_superadmin ?? false;
  const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', t.workspace_id).single();
  const isOwner = (ws as { owner_id: string } | null)?.owner_id === user.id;

  // Get actor's role in workspace_members
  const { data: actorMember } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', t.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  const { ROLE_WEIGHT } = await import('@/lib/team/permissions');
  const actorWeight = isSuperadmin ? 100 : isOwner ? 80 : ROLE_WEIGHT[(actorMember as { role: string } | null)?.role ?? ''] ?? 0;
  const targetWeight = isOwner && t.user_id && (ws as { owner_id: string } | null)?.owner_id === t.user_id ? 80 : ROLE_WEIGHT[t.role] ?? 0;

  if (actorWeight <= targetWeight) {
    return NextResponse.json({ error: 'Cannot modify a member with equal or higher role.' }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (body.role) updates['role'] = body.role;
  if (body.visible_modules) updates['visible_modules'] = body.visible_modules;

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: updated, error } = await admin.from('workspace_members').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch the member record; RLS verifies the calling user belongs to the same workspace
  const { data: member } = await supabase
    .from('workspace_members')
    .select('id, workspace_id, user_id')
    .eq('id', id)
    .single();

  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const m = member as { id: string; workspace_id: string; user_id: string | null };

  // Only workspace owner can remove members
  const { data: ws } = await supabase
    .from('workspaces')
    .select('owner_id')
    .eq('id', m.workspace_id)
    .single();

  if ((ws as { owner_id: string } | null)?.owner_id !== user.id) {
    return NextResponse.json({ error: 'Only the workspace owner can remove members' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('workspace_members').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
