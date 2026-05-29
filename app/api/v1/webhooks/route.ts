/**
 * Customer-facing Webhook Endpoints API
 *
 * GET  /api/v1/webhooks  — list all endpoints for the workspace
 * POST /api/v1/webhooks  — register a new endpoint
 *
 * Authentication: Bearer <api_key>
 *
 * Available events:
 *   call.completed  — fired when a call ends (includes transcript + recording)
 *   call.started    — fired when a room is created
 *   call.failed     — fired when Twilio/LiveKit reports a failure
 *   campaign.run_complete — fired when a campaign batch finishes
 *   *               — wildcard, receive all events
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
    .from('api_keys')
    .select('workspace_id, is_active')
    .eq('key_hash', hashed)
    .single();

  if (!data || !(data as { is_active: boolean }).is_active) return null;
  return { workspaceId: (data as { workspace_id: string }).workspace_id };
}

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('webhook_endpoints')
    .select('id, url, events, description, is_active, last_delivery_at, last_delivery_status, last_delivery_status_code, created_at, updated_at')
    .eq('workspace_id', auth.workspaceId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Never return the secret in list responses
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { url?: string; events?: string[]; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { url, events = ['call.completed'], description } = body;

  if (!url) return NextResponse.json({ error: '"url" is required.' }, { status: 400 });

  try { new URL(url); } catch {
    return NextResponse.json({ error: '"url" must be a valid HTTPS URL.' }, { status: 400 });
  }
  if (!url.startsWith('https://')) {
    return NextResponse.json({ error: '"url" must use HTTPS.' }, { status: 400 });
  }

  const invalidEvents = events.filter((e) => !ALLOWED_EVENTS.has(e));
  if (invalidEvents.length) {
    return NextResponse.json(
      { error: `Invalid events: ${invalidEvents.join(', ')}. Allowed: ${[...ALLOWED_EVENTS].join(', ')}` },
      { status: 400 }
    );
  }

  // Generate a random 32-byte secret — shown once on creation
  const secret = crypto.randomBytes(32).toString('hex');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('webhook_endpoints')
    .insert({
      workspace_id: auth.workspaceId,
      url,
      secret,
      events,
      description: description ?? null,
    })
    .select('id, url, events, description, is_active, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    {
      ...data,
      // Secret returned ONCE at creation time — store it securely, it cannot be retrieved again
      secret,
      _note: 'Store the secret securely. It will not be shown again. Use it to verify the X-VoiceOS-Signature header.',
    },
    { status: 201 }
  );
}
