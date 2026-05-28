/**
 * GET  /api/webhooks/endpoints  — list workspace endpoints (secret omitted)
 * POST /api/webhooks/endpoints  — create endpoint; secret returned once
 *
 * Session-auth (Supabase cookie) — for the dashboard UI.
 * The public API-key-auth version lives at /api/v1/webhooks.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_EVENTS = ['call.completed', 'call.started', 'call.failed', 'campaign.run_complete', '*'];

async function requireWorkspace(): Promise<{ workspaceId: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  return ws ? { workspaceId: (ws as { id: string }).id } : null;
}

export async function GET() {
  const ctx = await requireWorkspace();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('webhook_endpoints')
    .select('id, url, events, description, is_active, last_delivery_at, last_delivery_status, last_delivery_status_code, created_at')
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  const ctx = await requireWorkspace();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { url?: string; events?: string[]; description?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { url, events = ['call.completed'], description } = body;
  if (!url) return NextResponse.json({ error: '"url" is required.' }, { status: 400 });

  try { new URL(url); } catch {
    return NextResponse.json({ error: 'Invalid URL format.' }, { status: 400 });
  }
  if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
    return NextResponse.json({ error: '"url" must use HTTPS (or http://localhost for testing).' }, { status: 400 });
  }

  const invalid = events.filter((e) => !ALLOWED_EVENTS.includes(e));
  if (invalid.length) {
    return NextResponse.json({ error: `Invalid events: ${invalid.join(', ')}` }, { status: 400 });
  }

  // Admin client so we can read back the DB-generated secret
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('webhook_endpoints')
    .insert({ workspace_id: ctx.workspaceId, url, events, description: description ?? null })
    .select('id, url, events, description, is_active, secret, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = data as { id: string; url: string; events: string[]; description: string | null; is_active: boolean; secret: string; created_at: string };
  return NextResponse.json({ ...row }, { status: 201 });
}
