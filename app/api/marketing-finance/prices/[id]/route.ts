import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

async function guardSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('users').select('is_superadmin').eq('id', user.id).single();
  return profile?.is_superadmin ? user : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await guardSuperadmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as { price?: number; notes?: string; campaign?: string; country?: string };

  const updates: Record<string, unknown> = {};
  if (body.price !== undefined) {
    if (isNaN(body.price)) return NextResponse.json({ error: 'price must be a number' }, { status: 400 });
    updates.price = body.price;
  }
  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
  if (body.campaign !== undefined) {
    if (!body.campaign.trim()) return NextResponse.json({ error: 'campaign cannot be empty' }, { status: 400 });
    updates.campaign = body.campaign.trim();
  }
  if (body.country !== undefined) updates.country = (body.country.trim() || 'ALL');

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('mf_cpa_prices')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (error.code === '23505') return NextResponse.json({ error: 'Duplicate campaign+country combination' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await guardSuperadmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin
    .from('mf_cpa_prices')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
