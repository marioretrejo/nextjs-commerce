import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { invite_token } = await req.json() as { invite_token: string };
  if (!invite_token) return NextResponse.json({ error: 'invite_token required' }, { status: 400 });

  const admin = createAdminClient();

  const { data: member, error: fetchError } = await admin
    .from('workspace_members')
    .select('id, workspace_id, status')
    .eq('invite_token', invite_token)
    .eq('status', 'pending')
    .single();

  if (fetchError || !member) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });
  }

  const m = member as { id: string; workspace_id: string; status: string };

  const { error } = await admin
    .from('workspace_members')
    .update({ user_id: user.id, status: 'active', invite_token: null, invite_email: null })
    .eq('id', m.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ workspace_id: m.workspace_id });
}
