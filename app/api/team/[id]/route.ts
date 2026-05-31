import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { notifyWorkspace } from '@/lib/notifications/activity';

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

  // Only superadmins OR the workspace owner can manage roles and module visibility
  const { data: profile } = await supabase.from('users').select('is_superadmin, name, email').eq('id', user.id).single();
  const isSuperadmin = (profile as { is_superadmin: boolean } | null)?.is_superadmin ?? false;
  const actorName = (profile as { name?: string; email?: string } | null)?.name
    ?? (profile as { name?: string; email?: string } | null)?.email
    ?? 'Admin';

  const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', t.workspace_id).single();
  const isOwner = (ws as { owner_id: string } | null)?.owner_id === user.id;

  if (!isSuperadmin && !isOwner) {
    return NextResponse.json({ error: 'Only the workspace owner or a superadmin can manage roles.' }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (body.role) updates['role'] = body.role;
  if (body.visible_modules) updates['visible_modules'] = body.visible_modules;

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: updated, error } = await admin.from('workspace_members').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.role) {
    void notifyWorkspace({
      workspaceId: t.workspace_id,
      title: 'Role updated',
      message: `${actorName} changed a team member's role to ${body.role}.`,
      link: '/team',
      actorName,
    });
  }

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

  const { data: profile } = await supabase.from('users').select('name, email').eq('id', user.id).single();
  const actorName = (profile as { name?: string; email?: string } | null)?.name
    ?? (profile as { name?: string; email?: string } | null)?.email
    ?? 'Owner';

  const admin = createAdminClient();
  const { error } = await admin.from('workspace_members').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void notifyWorkspace({
    workspaceId: m.workspace_id,
    title: 'Team member removed',
    message: `${actorName} removed a member from the workspace.`,
    link: '/team',
    actorName,
  });

  return new NextResponse(null, { status: 204 });
}
