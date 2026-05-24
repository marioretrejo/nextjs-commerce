import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export async function deliverWebhook(
  workspaceId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient();
  const { data: integrations } = await admin
    .from('integrations')
    .select('webhook_url, webhook_events, credentials')
    .eq('workspace_id', workspaceId)
    .eq('type', 'webhook')
    .eq('status', 'connected');

  if (!integrations?.length) return;

  for (const integration of integrations) {
    if (!integration.webhook_url) continue;
    const events = (integration.webhook_events as string[]) ?? [];
    if (!events.includes(event)) continue;

    const body = JSON.stringify({ event, data: payload, timestamp: Date.now() });
    const creds = (integration.credentials as Record<string, unknown>) ?? {};
    const secret = creds['webhook_secret'] as string | undefined;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secret) {
      const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
      headers['X-VoiceOS-Signature'] = `sha256=${sig}`;
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(integration.webhook_url, { method: 'POST', headers, body });
        if (res.ok) break;
      } catch {
        // continue to retry
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, (attempt + 1) * 1000 * 3 ** attempt));
    }
  }
}
