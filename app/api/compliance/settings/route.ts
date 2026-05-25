import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

async function getWorkspaceId(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .single();
  return data?.workspace_id ?? null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = await getWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json(null);

  const admin = createAdminClient();
  const { data } = await admin.from('compliance_settings').select('*').eq('workspace_id', workspaceId).single();
  return NextResponse.json(data ?? null);
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = await getWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 400 });

  const body = await req.json() as Record<string, unknown>;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('compliance_settings')
    .upsert({ workspace_id: workspaceId, ...body, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
