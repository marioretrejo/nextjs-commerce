import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

interface DeliveryTarget {
  id:     string;
  url:    string;
  secret: string;
  events: string[];
}

/**
 * Build the signed delivery headers for a webhook payload.
 */
function buildHeaders(body: string, secret: string): Record<string, string> {
  const ts  = Math.floor(Date.now() / 1000).toString();
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${ts}.${body}`)
    .digest('hex');

  return {
    'Content-Type':       'application/json',
    'X-VoiceOS-Signature': `t=${ts},v1=${sig}`,
    'X-VoiceOS-Event':    '',  // overwritten per call
  };
}

/**
 * Attempt delivery to one endpoint with up to 3 retries (exponential back-off).
 * Returns the final HTTP status code, or 0 on network failure.
 */
async function deliverToEndpoint(
  endpoint: DeliveryTarget,
  event: string,
  payload: Record<string, unknown>
): Promise<number> {
  const body = JSON.stringify({ event, data: payload, timestamp: Date.now() });
  const hdrs = buildHeaders(body, endpoint.secret);
  hdrs['X-VoiceOS-Event'] = event;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(endpoint.url, { method: 'POST', headers: hdrs, body });
      if (res.ok) return res.status;
    } catch {
      // network error — fall through to retry
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1000 * 3 ** attempt)); // 1s, 3s
    }
  }
  return 0;
}

/**
 * Fetch enriched call data (transcript, recording_url, analysis) for a room.
 * Used to hydrate call.completed webhook payloads.
 */
async function getCallEnrichment(
  admin: ReturnType<typeof createAdminClient>,
  roomName: string
): Promise<{
  call_id: string | null;
  transcript: unknown;
  recording_url: string | null;
  analysis: unknown;
  duration_seconds: number;
}> {
  const { data: call } = await admin
    .from('calls')
    .select('id, transcript, recording_url, summary, duration_seconds')
    .eq('retell_call_id', roomName)
    .limit(1)
    .single();

  if (!call) {
    return { call_id: null, transcript: null, recording_url: null, analysis: null, duration_seconds: 0 };
  }

  const c = call as {
    id: string;
    transcript: string | null;
    recording_url: string | null;
    summary: string | null;
    duration_seconds: number;
  };

  return {
    call_id:          c.id,
    transcript:       c.transcript    ?? null,
    recording_url:    c.recording_url ?? null,
    analysis:         c.summary       ?? null,
    duration_seconds: c.duration_seconds ?? 0,
  };
}

/**
 * Deliver a webhook event to all active endpoints subscribed to `event`
 * for the given workspace.
 *
 * Sources:
 *   1. webhook_endpoints table (new — multi-endpoint, per-workspace)
 *   2. integrations table type='webhook' (legacy — one per workspace)
 *
 * For call.completed events the payload is automatically enriched with
 * transcript, recording_url, and analysis_result fetched from the DB.
 */
export async function deliverWebhook(
  workspaceId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient();

  // ── Enrich call.completed payloads ────────────────────────────────────────
  let enrichedPayload = payload;
  if (event === 'call.completed' && payload['room_name']) {
    const enrichment = await getCallEnrichment(admin, payload['room_name'] as string);
    enrichedPayload = {
      ...payload,
      call_id:          enrichment.call_id          ?? payload['call_id'],
      transcript:       enrichment.transcript,
      recording_url:    enrichment.recording_url,
      analysis:         enrichment.analysis,
      duration_seconds: enrichment.duration_seconds || payload['duration_seconds'],
    };
  }

  // ── Collect delivery targets ───────────────────────────────────────────────
  const targets: DeliveryTarget[] = [];

  // Source 1: webhook_endpoints table
  const { data: endpoints } = await admin
    .from('webhook_endpoints')
    .select('id, url, secret, events')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  for (const ep of endpoints ?? []) {
    const evts = (ep.events as string[]) ?? [];
    if (evts.includes(event) || evts.includes('*')) {
      targets.push({ id: ep.id, url: ep.url, secret: ep.secret, events: evts });
    }
  }

  // Source 2: integrations table (legacy webhook type)
  const { data: integrations } = await admin
    .from('integrations')
    .select('id, webhook_url, webhook_events, credentials')
    .eq('workspace_id', workspaceId)
    .eq('type', 'webhook')
    .eq('status', 'connected');

  for (const ig of integrations ?? []) {
    if (!ig.webhook_url) continue;
    const evts = (ig.webhook_events as string[]) ?? [];
    if (!evts.includes(event)) continue;
    const creds  = (ig.credentials as Record<string, unknown>) ?? {};
    const secret = (creds['webhook_secret'] as string | undefined) ?? '';
    targets.push({ id: `integration:${ig.id}`, url: ig.webhook_url, secret, events: evts });
  }

  if (!targets.length) return;

  // ── Deliver in parallel (fire-and-forget) ─────────────────────────────────
  await Promise.allSettled(
    targets.map(async (target) => {
      const statusCode = await deliverToEndpoint(target, event, enrichedPayload);
      const status     = statusCode >= 200 && statusCode < 300 ? 'success' : 'failure';

      // Record delivery outcome for webhook_endpoints (not integrations)
      if (!target.id.startsWith('integration:')) {
        void Promise.resolve(
          admin.rpc('record_webhook_delivery', {
            p_endpoint_id:  target.id,
            p_status:       status,
            p_status_code:  statusCode,
          })
        ).catch(() => null);
      }
    })
  );
}
