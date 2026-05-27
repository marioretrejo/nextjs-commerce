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

  let query = supabase.from('phone_numbers').select('*, agent:agents(name)').order('created_at', { ascending: false });
  if (workspaceId) query = query.eq('workspace_id', workspaceId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

type PostBody =
  | { provider?: 'twilio'; workspace_id?: string; country_code: string; phone_number?: string }
  | { provider: 'sip_trunk'; workspace_id?: string; phone_number: string; sip_trunk_uri: string; display_name?: string; country_code?: string };

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as PostBody;

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

  const { data: ws } = await supabase.from('workspaces').select('id').eq('id', workspaceId).single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const admin = createAdminClient();

  // SIP Trunk — bring-your-own-number flow
  if (body.provider === 'sip_trunk') {
    const { phone_number, sip_trunk_uri, display_name, country_code } = body;
    if (!phone_number || !sip_trunk_uri) {
      return NextResponse.json({ error: 'phone_number and sip_trunk_uri are required for SIP trunk' }, { status: 400 });
    }

    // Normalize E.164 format
    const normalized = phone_number.startsWith('+') ? phone_number : `+${phone_number}`;

    const { data, error } = await admin.from('phone_numbers').insert({
      workspace_id: workspaceId,
      number: normalized,
      country_code: country_code ?? 'US',
      country_name: country_code ?? 'Unknown',
      provider: 'sip_trunk',
      sip_trunk_uri,
      display_name: display_name ?? normalized,
      status: 'available',
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  // Twilio provisioning flow
  let phone: string;
  let sid: string | undefined;
  const countryCode = (body as { country_code: string }).country_code;

  if (process.env['TWILIO_ACCOUNT_SID']) {
    try {
      const available = await twilio.searchAvailable(countryCode);
      const first = available.available_phone_numbers?.[0];
      if (!first) return NextResponse.json({ error: 'No numbers available in that country' }, { status: 400 });

      const provisioned = await twilio.provisionNumber(first.phone_number);
      phone = provisioned.phone_number;
      sid = provisioned.sid;
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  } else {
    phone = (body as { phone_number?: string }).phone_number
      ?? `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`;
  }

  const { SUPPORTED_COUNTRIES } = await import('@/lib/twilio/client');
  const country = SUPPORTED_COUNTRIES.find((c) => c.code === countryCode);

  const { data, error } = await admin.from('phone_numbers').insert({
    workspace_id: workspaceId,
    number: phone,
    country_code: countryCode,
    country_name: country?.name ?? countryCode,
    provider: 'twilio',
    status: 'available',
    twilio_sid: sid ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
