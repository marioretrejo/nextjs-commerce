/**
 * PATCH  /api/webhooks/endpoints/:id  — update url / events / description / is_active
 * DELETE /api/webhooks/endpoints/:id  — permanently remove
 *
 * Session-auth, workspace-scoped.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_EVENTS = ['call.completed', 'call.started', 'call.failed', 'campaign.run_complete', '*'];

async function getWorkspaceId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single();
  return ws ? (ws as { id: string }).id : null;
}

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { url?: string; events?: string[]; description?: string; is_active?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.url !== undefined) {
    try { new URL(body.url); } catch {
      return NextResponse.json({ error: 'Invalid URL.' }, { status: 400 });
    }
    update['url'] = body.url;
  }
  if (body.events !== undefined) {
    const invalid = body.events.filter((e) => !ALLOWED_EVENTS.includes(e));
    if (invalid.length) return NextResponse.json({ error: `Invalid events: ${invalid.join(', ')}` }, { status: 400 });
    update['events'] = body.events;
  }
  if (body.description !== undefined) update['description'] = body.description;
  if (body.is_active    !== undefined) update['is_active']   = body.is_active;

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('webhook_endpoints')
    .update(update)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select('id, url, events, description, is_active, updated_at')
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('webhook_endpoints')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
