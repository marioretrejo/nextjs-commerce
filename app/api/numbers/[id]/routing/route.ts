import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('phone_numbers')
    .select('id, number, inbound_enabled, routing_rules')
    .eq('id', id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify ownership via RLS
  const { data: phone } = await supabase.from('phone_numbers').select('id').eq('id', id).single();
  if (!phone) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as { inbound_enabled?: boolean; routing_rules?: unknown };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('phone_numbers')
    .update({
      ...(body.inbound_enabled !== undefined ? { inbound_enabled: body.inbound_enabled } : {}),
      ...(body.routing_rules !== undefined ? { routing_rules: body.routing_rules } : {}),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
