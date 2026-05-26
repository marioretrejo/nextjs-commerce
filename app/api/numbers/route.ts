import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { twilio } from '@/lib/twilio/client';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');

  // RLS scopes results to user's workspaces; the optional workspace_id filter narrows further
  let query = supabase.from('phone_numbers').select('*, agent:agents(name)').order('created_at', { ascending: false });
  if (workspaceId) query = query.eq('workspace_id', workspaceId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { workspace_id?: string; country_code: string; phone_number?: string };

  // Bug fix #2: auto-detect workspace_id from the authenticated user's first workspace
  let workspaceId = body.workspace_id;
  if (!workspaceId) {
    const { data: ws } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .single();
    workspaceId = (ws as { id: string } | null)?.id;
  }
  if (!workspaceId) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  // Verify the workspace belongs to this user via RLS
  const { data: ws } = await supabase.from('workspaces').select('id').eq('id', workspaceId).single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  let phone: string;
  let sid: string | undefined;

  if (process.env['TWILIO_ACCOUNT_SID']) {
    try {
      const available = await twilio.searchAvailable(body.country_code);
      const first = available.available_phone_numbers?.[0];
      if (!first) return NextResponse.json({ error: 'No numbers available in that country' }, { status: 400 });

      const provisioned = await twilio.provisionNumber(first.phone_number);
      phone = provisioned.phone_number;
      sid = provisioned.sid;
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  } else {
    phone = body.phone_number ?? `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`;
  }

  const { SUPPORTED_COUNTRIES } = await import('@/lib/twilio/client');
  const country = SUPPORTED_COUNTRIES.find((c) => c.code === body.country_code);

  const admin = createAdminClient();
  const { data, error } = await admin.from('phone_numbers').insert({
    workspace_id: workspaceId,
    number: phone,
    country_code: body.country_code,
    country_name: country?.name ?? body.country_code,
    provider: 'twilio',
    status: 'available',
    twilio_sid: sid ?? null
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
