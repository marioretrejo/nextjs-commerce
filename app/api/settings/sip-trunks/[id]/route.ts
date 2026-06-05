/**
 * PATCH  /api/settings/sip-trunks/[id]  — update trunk (credentials, priority, status)
 * DELETE /api/settings/sip-trunks/[id]  — remove trunk
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import type { SipTrunk } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

async function getWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: ws } = await supabase
    .from('workspaces').select('id').eq('owner_id', userId).single();
  return (ws as { id: string } | null)?.id ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const wsId = await getWorkspaceId(supabase, user.id);
  if (!wsId) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  let body: Partial<SipTrunk>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const allowed = ['name', 'provider', 'sip_host', 'port', 'username', 'password', 'netmask', 'protocol', 'region', 'priority', 'status'] as const;
  const update: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) update[k] = body[k];
  }
  if ('port' in update) {
    const p = Number(update['port']);
    if (p < 1 || p > 65535) return NextResponse.json({ error: 'port must be 1–65535' }, { status: 400 });
    update['port'] = p;
  }
  if ('netmask' in update) {
    const n = Number(update['netmask']);
    if (n < 0 || n > 32) return NextResponse.json({ error: 'netmask must be 0–32' }, { status: 400 });
    update['netmask'] = n;
  }

  // Reset cached LiveKit trunk ID whenever credentials change
  if ('sip_host' in update || 'port' in update || 'username' in update || 'password' in update || 'protocol' in update) {
    update['livekit_trunk_id'] = null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('sip_trunks')
    .update(update)
    .eq('id', id)
    .eq('workspace_id', wsId)
    .select('id, name, provider, sip_host, port, username, netmask, protocol, region, status, priority')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Trunk not found' }, { status: 404 });
  return NextResponse.json({ trunk: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const wsId = await getWorkspaceId(supabase, user.id);
  if (!wsId) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('sip_trunks')
    .delete()
    .eq('id', id)
    .eq('workspace_id', wsId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
