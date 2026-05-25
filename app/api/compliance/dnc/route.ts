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
  if (!workspaceId) return NextResponse.json([], { status: 200 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('dnc_entries')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('added_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = await getWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 400 });

  const body = await req.json() as { phone: string; reason?: string } | { phones: string[] };

  const admin = createAdminClient();

  if ('phones' in body) {
    // Bulk import
    const entries = body.phones.map(phone => ({ workspace_id: workspaceId, phone: phone.trim(), reason: 'Bulk import' }));
    const { data, error } = await admin.from('dnc_entries').upsert(entries, { onConflict: 'workspace_id,phone' }).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ inserted: (data ?? []).length }, { status: 201 });
  }

  const { data, error } = await admin
    .from('dnc_entries')
    .upsert({ workspace_id: workspaceId, phone: body.phone.trim(), reason: body.reason ?? null }, { onConflict: 'workspace_id,phone' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = await getWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 400 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from('dnc_entries').delete().eq('id', id).eq('workspace_id', workspaceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
