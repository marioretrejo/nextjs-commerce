import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single();
    if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const country = searchParams.get('country') ?? 'US';
    const type = searchParams.get('type') ?? 'local';

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

    const typeSegment = type === 'tollfree' ? 'TollFree' : 'Local';
    const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.account_sid}/AvailablePhoneNumbers/${country}/${typeSegment}.json?PageSize=20&VoiceEnabled=true`;

    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });

    if (!res.ok) {
      const errText = await res.text();
      let errMsg = 'Failed to search numbers';
      try {
        const errJson = JSON.parse(errText) as { message?: string };
        errMsg = errJson.message ?? errMsg;
      } catch { /* use default */ }
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    const data = await res.json() as { available_phone_numbers: unknown[] };
    return NextResponse.json({ numbers: data.available_phone_numbers ?? [] });
  } catch (e) {
    console.error('[twilio-search]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
