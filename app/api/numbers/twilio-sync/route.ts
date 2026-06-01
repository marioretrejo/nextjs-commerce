import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface TwilioIncomingNumber {
  sid: string;
  phone_number: string;
  friendly_name: string;
  iso_country: string;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single();
    if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    const admin = createAdminClient();
    const { data: integration } = await admin
      .from('integrations')
      .select('credentials')
      .eq('workspace_id', ws.id)
      .eq('type', 'twilio')
      .eq('status', 'connected')
      .maybeSingle();

    if (!integration) return NextResponse.json({ error: 'Twilio not connected' }, { status: 400 });

    const creds = integration.credentials as { account_sid: string; auth_token: string };
    const auth = Buffer.from(`${creds.account_sid}:${creds.auth_token}`).toString('base64');

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${creds.account_sid}/IncomingPhoneNumbers.json?PageSize=100`,
      { headers: { Authorization: `Basic ${auth}` } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch Twilio numbers' }, { status: 502 });
    }

    const data = await res.json() as { incoming_phone_numbers: TwilioIncomingNumber[] };
    const twilioNumbers = data.incoming_phone_numbers ?? [];

    if (twilioNumbers.length > 0) {
      const { data: existing } = await admin
        .from('phone_numbers')
        .select('number')
        .eq('workspace_id', ws.id)
        .eq('provider', 'twilio');

      const existingSet = new Set((existing ?? []).map(n => n.number));
      const toInsert = twilioNumbers.filter(n => !existingSet.has(n.phone_number));

      if (toInsert.length > 0) {
        await admin.from('phone_numbers').insert(
          toInsert.map(n => ({
            workspace_id: ws.id,
            number: n.phone_number,
            provider: 'twilio',
            country_code: n.iso_country || 'US',
            country_name: n.friendly_name,
            status: 'available',
            twilio_sid: n.sid,
          }))
        );
      }
    }

    return NextResponse.json({ numbers: twilioNumbers, synced: twilioNumbers.length });
  } catch (e) {
    console.error('[twilio-sync]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
