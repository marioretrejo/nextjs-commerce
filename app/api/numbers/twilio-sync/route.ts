import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface TwilioIncomingNumber {
  sid: string;
  phone_number: string;
  friendly_name: string;
  iso_country: string;
}

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', MX: 'Mexico', CA: 'Canada', GB: 'United Kingdom',
  ES: 'Spain', DE: 'Germany', FR: 'France', IT: 'Italy', PT: 'Portugal',
  BR: 'Brazil', AR: 'Argentina', CO: 'Colombia', CL: 'Chile', PE: 'Peru',
  EC: 'Ecuador', VE: 'Venezuela', BO: 'Bolivia', UY: 'Uruguay', PY: 'Paraguay',
  DO: 'Dominican Republic', GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador',
  NI: 'Nicaragua', CR: 'Costa Rica', PA: 'Panama', PR: 'Puerto Rico',
  AU: 'Australia', NZ: 'New Zealand', JP: 'Japan', KR: 'South Korea', CN: 'China',
  IN: 'India', SG: 'Singapore', HK: 'Hong Kong', PH: 'Philippines',
  ZA: 'South Africa', NG: 'Nigeria', KE: 'Kenya', EG: 'Egypt',
  NL: 'Netherlands', BE: 'Belgium', CH: 'Switzerland', AT: 'Austria',
  SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland', PL: 'Poland',
  CZ: 'Czech Republic', HU: 'Hungary', RO: 'Romania', IL: 'Israel',
  AE: 'United Arab Emirates', SA: 'Saudi Arabia', TR: 'Turkey',
};

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
      const errText = await res.text();
      console.error('[twilio-sync] Twilio API error:', res.status, errText);
      return NextResponse.json({ error: 'Failed to fetch Twilio numbers — check credentials' }, { status: 502 });
    }

    const data = await res.json() as { incoming_phone_numbers: TwilioIncomingNumber[] };
    const twilioNumbers = data.incoming_phone_numbers ?? [];

    let insertedCount = 0;

    if (twilioNumbers.length > 0) {
      const { data: existing } = await admin
        .from('phone_numbers')
        .select('number')
        .eq('workspace_id', ws.id)
        .eq('provider', 'twilio');

      const existingSet = new Set((existing ?? []).map(n => n.number));
      const toInsert = twilioNumbers.filter(n => !existingSet.has(n.phone_number));

      if (toInsert.length > 0) {
        const { error: insertErr } = await admin.from('phone_numbers').insert(
          toInsert.map(n => ({
            workspace_id: ws.id,
            number: n.phone_number,
            provider: 'twilio',
            country_code: n.iso_country || 'US',
            country_name: COUNTRY_NAMES[n.iso_country] ?? n.iso_country ?? 'Unknown',
            status: 'available',
            twilio_sid: n.sid,
          }))
        );
        if (insertErr) {
          console.error('[twilio-sync] insert error:', insertErr.message);
        } else {
          insertedCount = toInsert.length;
        }
      }
    }

    return NextResponse.json({ numbers: twilioNumbers, synced: insertedCount });
  } catch (e) {
    console.error('[twilio-sync]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
