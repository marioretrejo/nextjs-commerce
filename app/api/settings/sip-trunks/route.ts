/**
 * GET  /api/settings/sip-trunks  — list workspace SIP trunks
 * POST /api/settings/sip-trunks  — create a new SIP trunk
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import type { SipTrunk } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: ws } = await supabase
    .from('workspaces').select('id').eq('owner_id', user.id).single();
  if (!ws) return NextResponse.json({ trunks: [] });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('sip_trunks')
    .select('id, name, provider, sip_host, port, username, netmask, protocol, region, status, priority, last_tested_at, created_at')
    .eq('workspace_id', (ws as { id: string }).id)
    .order('priority', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trunks: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Partial<SipTrunk>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, provider, sip_host, port, username, password, netmask, protocol, region, priority } = body;
  if (!name?.trim())      return NextResponse.json({ error: '"name" is required' }, { status: 400 });
  if (!provider)          return NextResponse.json({ error: '"provider" is required' }, { status: 400 });
  if (!sip_host?.trim())  return NextResponse.json({ error: '"sip_host" is required' }, { status: 400 });
  if (!username?.trim())  return NextResponse.json({ error: '"username" is required' }, { status: 400 });
  if (!password?.trim())  return NextResponse.json({ error: '"password" is required' }, { status: 400 });

  const portNum = port ?? 5060;
  if (portNum < 1 || portNum > 65535) return NextResponse.json({ error: 'port must be 1–65535' }, { status: 400 });
  const netmaskNum = netmask ?? 32;
  if (netmaskNum < 0 || netmaskNum > 32) return NextResponse.json({ error: 'netmask must be 0–32' }, { status: 400 });

  const { data: ws } = await supabase
    .from('workspaces').select('id').eq('owner_id', user.id).single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('sip_trunks')
    .insert({
      workspace_id: (ws as { id: string }).id,
      name:         name.trim(),
      provider,
      sip_host:     sip_host.trim(),
      port:         portNum,
      username:     username.trim(),
      password:     password.trim(),
      netmask:      netmaskNum,
      protocol:     protocol ?? 'UDP',
      region:       region ?? null,
      priority:     priority ?? 0,
      status:       'active',
    })
    .select('id, name, provider, sip_host, port, username, netmask, protocol, region, status, priority, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trunk: data }, { status: 201 });
}
