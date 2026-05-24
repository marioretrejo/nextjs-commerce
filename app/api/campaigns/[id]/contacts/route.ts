import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { contacts } = await req.json() as { contacts: Record<string, unknown>[] };
  if (!contacts?.length) return NextResponse.json({ error: 'No contacts' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from('campaign_contacts').insert(
    contacts.map((c) => ({ ...c, campaign_id: id }))
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update total_contacts count
  const { count } = await admin.from('campaign_contacts').select('*', { count: 'exact', head: true }).eq('campaign_id', id);
  await admin.from('campaigns').update({ total_contacts: count ?? 0 }).eq('id', id);

  return NextResponse.json({ ok: true, inserted: contacts.length });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('campaign_contacts')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
