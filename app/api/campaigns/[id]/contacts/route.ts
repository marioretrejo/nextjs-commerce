import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify campaign ownership via RLS before writing
  const { data: campaign } = await supabase.from('campaigns').select('id').eq('id', id).single();
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { contacts } = await req.json() as { contacts: Record<string, unknown>[] };
  if (!contacts?.length) return NextResponse.json({ error: 'No contacts' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from('campaign_contacts').insert(
    contacts.map((c) => ({ ...c, campaign_id: id }))
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await admin.from('campaign_contacts').select('*', { count: 'exact', head: true }).eq('campaign_id', id);
  await admin.from('campaigns').update({ total_contacts: count ?? 0 }).eq('id', id);

  return NextResponse.json({ ok: true, inserted: contacts.length });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // RLS scopes campaign_contacts to owned workspaces via the campaign join
  const { data, error } = await supabase
    .from('campaign_contacts')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
