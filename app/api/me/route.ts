import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
  if (!data) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json({ user: data });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { name?: string; company?: string };
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('users')
    .update({ name: body.name, company: body.company })
    .eq('id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  // Delete user data — RLS cascades will clean up workspaces, agents, etc.
  await admin.from('users').delete().eq('id', user.id);
  // Delete the Supabase Auth user
  await admin.auth.admin.deleteUser(user.id);
  return NextResponse.json({ ok: true });
}
