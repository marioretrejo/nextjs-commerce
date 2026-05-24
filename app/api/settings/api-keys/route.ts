import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single();
  if (!ws) return NextResponse.json({ keys: [] });

  const admin = createAdminClient();
  const { data } = await admin
    .from('api_keys')
    .select('id, name, key_prefix, last_used_at, created_at')
    .eq('workspace_id', ws.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { name: string };
  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const rawKey = 'vos_' + crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 12);

  const admin = createAdminClient();
  const { data, error } = await admin.from('api_keys').insert({
    workspace_id: ws.id,
    name: body.name,
    key_hash: keyHash,
    key_prefix: keyPrefix,
  }).select('id, name, key_prefix, created_at').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ key: rawKey, meta: data }, { status: 201 });
}
