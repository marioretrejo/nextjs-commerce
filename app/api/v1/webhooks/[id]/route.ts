/**
 * GET    /api/v1/webhooks/:id  — get a single endpoint (no secret)
 * PATCH  /api/v1/webhooks/:id  — update url / events / description / is_active
 * DELETE /api/v1/webhooks/:id  — permanently delete
 *
 * Authentication: Bearer <api_key>
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const ALLOWED_EVENTS = new Set([
  'call.completed', 'call.started', 'call.failed',
  'campaign.run_complete', '*',
]);

async function authenticateApiKey(
  req: Request
): Promise<{ workspaceId: string } | null> {
  const rawKey = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!rawKey) return null;
  const hashed = crypto.createHash('sha256').update(rawKey).digest('hex');
  const admin = createAdminClient();
  const { data } = await admin
    .from('api_keys').select('workspace_id, is_active').eq('key_hash', hashed).single();
  if (!data || !(data as { is_active: boolean }).is_active) return null;
  return { workspaceId: (data as { workspace_id: string }).workspace_id };
}

type Params = Promise<{ id: string }>;

export async function GET(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('webhook_endpoints')
    .select('id, url, events, description, is_active, last_delivery_at, last_delivery_status, last_delivery_status_code, created_at, updated_at')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { url?: string; events?: string[]; description?: string; is_active?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.url !== undefined) {
    try { new URL(body.url); } catch {
      return NextResponse.json({ error: '"url" must be a valid HTTPS URL.' }, { status: 400 });
    }
    if (!body.url.startsWith('https://')) {
      return NextResponse.json({ error: '"url" must use HTTPS.' }, { status: 400 });
    }
    update['url'] = body.url;
  }
  if (body.events !== undefined) {
    const invalid = body.events.filter((e) => !ALLOWED_EVENTS.has(e));
    if (invalid.length) {
      return NextResponse.json({ error: `Invalid events: ${invalid.join(', ')}` }, { status: 400 });
    }
    update['events'] = body.events;
  }
  if (body.description !== undefined) update['description'] = body.description;
  if (body.is_active    !== undefined) update['is_active']   = body.is_active;

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('webhook_endpoints')
    .update(update)
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .select('id, url, events, description, is_active, updated_at')
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found or update failed.' }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('webhook_endpoints')
    .delete()
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
