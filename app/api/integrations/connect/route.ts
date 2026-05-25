import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { type: string };
  const { type } = body;
  if (!type) return NextResponse.json({ error: 'type required' }, { status: 400 });

  const AVAILABLE_INTEGRATIONS = ['hubspot', 'webhook'];
  if (!AVAILABLE_INTEGRATIONS.includes(type)) {
    return NextResponse.json({ error: 'Integration not available yet' }, { status: 400 });
  }

  // For HubSpot, return OAuth redirect URL
  if (type === 'hubspot') {
    const clientId = process.env['HUBSPOT_CLIENT_ID'];
    const redirectUri = `${process.env['NEXT_PUBLIC_APP_URL']}/api/integrations/hubspot/callback`;
    if (clientId) {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri ?? '',
        scope: 'crm.objects.contacts.write crm.objects.contacts.read timeline',
        response_type: 'code',
      });
      return NextResponse.json({ redirect_url: `https://app.hubspot.com/oauth/authorize?${params.toString()}` });
    }
  }

  // Get user's workspace
  const { data: ws } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const admin = createAdminClient();
  const { data, error } = await admin.from('integrations').upsert({
    workspace_id: ws.id,
    type,
    status: 'connected',
    credentials: {},
    webhook_url: null,
    webhook_events: [],
  }, { onConflict: 'workspace_id,type' }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
