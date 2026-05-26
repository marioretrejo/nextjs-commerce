import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if workspace already exists — avoid duplicates
  const { data: existing } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ id: existing.id });
  }

  const admin = createAdminClient();

  const displayName = user.user_metadata?.['full_name'] as string | undefined
    ?? user.email?.split('@')[0]
    ?? 'My';

  const { data: workspace, error } = await admin
    .from('workspaces')
    .insert({
      owner_id: user.id,
      name: `${displayName}'s Workspace`,
      plan: 'free',
      minutes_limit: 50,
    })
    .select('id')
    .single();

  if (error || !workspace) {
    console.error('[workspaces] insert error:', error);
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
  }

  await admin.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'admin',
    status: 'active',
    joined_at: new Date().toISOString(),
  });

  return NextResponse.json({ id: workspace.id });
}
