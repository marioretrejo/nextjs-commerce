import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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
