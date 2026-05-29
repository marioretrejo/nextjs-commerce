import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single();
  if (!ws) return NextResponse.json({ connected: false });

  const admin = createAdminClient();
  const { data } = await admin
    .from('integrations')
    .select('id, status, credentials')
    .eq('workspace_id', ws.id)
    .eq('type', 'twilio')
    .maybeSingle();

  if (!data) return NextResponse.json({ connected: false });

  // Return connected status + masked account SID (never expose auth token)
  const creds = data.credentials as { account_sid?: string } | null;
  return NextResponse.json({
    connected: data.status === 'active',
    account_sid: creds?.account_sid
      ? creds.account_sid.slice(0, 4) + '…' + creds.account_sid.slice(-4)
      : null,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { account_sid?: string; auth_token?: string };
  if (!body.account_sid || !body.auth_token) {
    return NextResponse.json({ error: 'account_sid and auth_token required' }, { status: 400 });
  }

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  // Validate credentials with Twilio API before saving
  const auth = Buffer.from(`${body.account_sid}:${body.auth_token}`).toString('base64');
  const validateRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${body.account_sid}.json`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  if (!validateRes.ok) {
    return NextResponse.json({ error: 'Invalid Twilio credentials. Please check your Account SID and Auth Token.' }, { status: 422 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('integrations')
    .upsert(
      {
        workspace_id: ws.id,
        type: 'twilio',
        status: 'active',
        credentials: { account_sid: body.account_sid, auth_token: body.auth_token },
      },
      { onConflict: 'workspace_id,type' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connected: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const admin = createAdminClient();
  await admin
    .from('integrations')
    .update({ status: 'inactive' })
    .eq('workspace_id', ws.id)
    .eq('type', 'twilio');

  return NextResponse.json({ connected: false });
}
