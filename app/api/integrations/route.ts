import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');

  // RLS scopes to user's workspaces; optional filter narrows to one workspace
  let query = supabase.from('integrations').select('*').order('type');
  if (workspaceId) query = query.eq('workspace_id', workspaceId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  if (!body['workspace_id']) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  // Verify workspace ownership via RLS
  const { data: ws } = await supabase.from('workspaces').select('id').eq('id', body['workspace_id'] as string).single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const admin = createAdminClient();
  const { data, error } = await admin.from('integrations').upsert({
    workspace_id: body['workspace_id'],
    type: body['type'],
    status: body['status'] ?? 'connected',
    credentials: body['credentials'] ?? {},
    webhook_url: body['webhook_url'] ?? null,
    webhook_events: body['webhook_events'] ?? []
  }, { onConflict: 'workspace_id,type' }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
