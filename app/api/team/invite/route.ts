import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email, role, workspace_id } = await req.json() as {
    email: string;
    role: string;
    workspace_id?: string;
  };

  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  // Get the workspace to invite to (default to user's first workspace)
  let wsId = workspace_id;
  if (!wsId) {
    const { data: ws } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .single();
    wsId = (ws as { id: string } | null)?.id;
  }

  if (!wsId) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  // Verify the calling user owns this workspace
  const { data: ws } = await supabase.from('workspaces').select('id').eq('id', wsId).single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const admin = createAdminClient();

  // Check if user already exists
  const { data: existingUser } = await admin
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  const inviteeId = (existingUser as { id: string } | null)?.id ?? null;

  // Upsert member record
  const { data, error } = await admin.from('workspace_members').upsert({
    workspace_id: wsId,
    user_id: inviteeId,
    role: role ?? 'editor',
    status: inviteeId ? 'active' : 'pending',
    invite_email: inviteeId ? null : email,
    invited_by: user.id
  }, { onConflict: 'workspace_id,user_id' }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
