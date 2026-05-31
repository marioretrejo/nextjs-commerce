/**
 * Post-call integration dispatcher
 *
 * Called by the analyze-call job after LLM analysis completes.
 * Loads all active integrations for the workspace and fires them in parallel.
 * Every handler is non-blocking — errors are logged but never propagate.
 */

export interface PostCallPayload {
  call_id: string;
  workspace_id: string;
  agent_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  direction: string;
  duration_seconds: number;
  disposition: string | null;
  summary: string | null;
  sentiment: string | null;
  transcript: string | null;
  extracted_data: Record<string, unknown> | null;
  extracted_name: string | null;
  extracted_email: string | null;
  extracted_interest: string | null;
  extracted_objections: string | null;
  created_at: string;
}

interface IntegrationRow {
  type: string;
  status: string;
  credentials: Record<string, string> | null;
  webhook_url: string | null;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatDisposition(d: string | null): string {
  if (!d) return 'Unknown';
  const labels: Record<string, string> = {
    meeting_booked:     '✅ Meeting Booked',
    completed:          '✅ Completed',
    follow_up:          '🔄 Follow Up',
    callback_requested: '📅 Callback Requested',
    not_interested:     '❌ Not Interested',
    voicemail:          '📵 Voicemail',
    transferred:        '↗️ Transferred',
    other:              '⚪ Other',
  };
  return labels[d] ?? d;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function buildNotificationText(p: PostCallPayload): string {
  const contact = p.contact_name ?? p.contact_phone ?? 'Unknown Contact';
  const lines = [
    `📞 *Call Ended* — ${contact}`,
    `📊 Status: ${formatDisposition(p.disposition)}`,
    `⏱️ Duration: ${formatDuration(p.duration_seconds)}`,
  ];
  if (p.summary) {
    lines.push('', `📝 *Summary:*`);
    // Strip bullet characters and add as individual lines
    p.summary.split('\n').filter(Boolean).forEach(l => lines.push(l.replace(/^•\s*/, '• ')));
  }
  if (p.extracted_name)     lines.push(``, `👤 Contact: ${p.extracted_name}`);
  if (p.extracted_email)    lines.push(`📧 Email: ${p.extracted_email}`);
  if (p.extracted_interest) lines.push(`💡 Interest: ${p.extracted_interest}`);
  if (p.extracted_objections) lines.push(`⚠️ Objection: ${p.extracted_objections}`);
  return lines.join('\n');
}

// ── Integration handlers ──────────────────────────────────────────────────────

async function fireTelegram(creds: Record<string, string>, p: PostCallPayload): Promise<void> {
  const { bot_token, chat_id } = creds;
  if (!bot_token || !chat_id) return;

  const text = buildNotificationText(p);
  await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'Markdown' }),
  });
}

async function fireTeams(webhookUrl: string, p: PostCallPayload): Promise<void> {
  if (!webhookUrl) return;

  const contact = p.contact_name ?? p.contact_phone ?? 'Unknown Contact';
  const body = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: p.disposition === 'meeting_booked' || p.disposition === 'completed' ? '00b050' : 'e81123',
    summary: `Call ended with ${contact}`,
    sections: [
      {
        activityTitle: `📞 Call Ended — ${contact}`,
        activitySubtitle: `${formatDisposition(p.disposition)} · ${formatDuration(p.duration_seconds)}`,
        facts: [
          { name: 'Disposition', value: formatDisposition(p.disposition) },
          { name: 'Duration',    value: formatDuration(p.duration_seconds) },
          { name: 'Sentiment',   value: p.sentiment ?? '—' },
          ...(p.extracted_name  ? [{ name: 'Contact Name',  value: p.extracted_name }]  : []),
          ...(p.extracted_email ? [{ name: 'Contact Email', value: p.extracted_email }] : []),
          ...(p.extracted_interest ? [{ name: 'Interest', value: p.extracted_interest }] : []),
        ],
        ...(p.summary ? { text: p.summary.replace(/^•\s*/gm, '• ') } : {}),
      },
    ],
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function fireN8n(webhookUrl: string, p: PostCallPayload): Promise<void> {
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'call.analyzed',
      timestamp: new Date().toISOString(),
      call: {
        id:               p.call_id,
        workspace_id:     p.workspace_id,
        agent_id:         p.agent_id,
        contact_name:     p.contact_name,
        contact_phone:    p.contact_phone,
        direction:        p.direction,
        duration_seconds: p.duration_seconds,
        disposition:      p.disposition,
        summary:          p.summary,
        sentiment:        p.sentiment,
        transcript:       p.transcript,
        extracted_data:   p.extracted_data,
        extracted_name:   p.extracted_name,
        extracted_email:  p.extracted_email,
        extracted_interest:   p.extracted_interest,
        extracted_objections: p.extracted_objections,
        created_at:       p.created_at,
      },
    }),
  });
}

async function fireGoogleCalendar(creds: Record<string, string>, p: PostCallPayload): Promise<void> {
  // Only fires when disposition is meeting_booked and we have an OAuth refresh token
  if (p.disposition !== 'meeting_booked') return;
  const { refresh_token, client_id, client_secret } = creds;
  if (!refresh_token || !client_id || !client_secret) return;

  // Exchange refresh token for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id,
      client_secret,
      refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!tokenRes.ok) return;
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  const accessToken = tokenData.access_token;
  if (!accessToken) return;

  // Build a calendar event starting 24h from now (placeholder — real date
  // would come from extracted_data.meeting_date when the LLM extracts it)
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const end   = new Date(start.getTime() + 60 * 60 * 1000); // 1h meeting

  const contact = p.contact_name ?? p.contact_phone ?? 'Contact';
  const event = {
    summary: `Meeting with ${contact}`,
    description: p.summary ?? `Follow-up from VoiceOS call (${p.call_id})`,
    start: { dateTime: start.toISOString() },
    end:   { dateTime: end.toISOString() },
    attendees: p.extracted_email ? [{ email: p.extracted_email }] : [],
  };

  await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export async function dispatchPostCallEvents(
  workspaceId: string,
  payload: PostCallPayload,
): Promise<void> {
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!supabaseUrl || !supabaseKey) return;

  // Fetch all active integrations for this workspace
  let integrations: IntegrationRow[] = [];
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/integrations?workspace_id=eq.${workspaceId}&status=eq.connected&select=type,status,credentials,webhook_url`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      },
    );
    if (res.ok) integrations = (await res.json()) as IntegrationRow[];
  } catch {
    return; // Non-fatal
  }

  if (!integrations.length) return;

  const handlers: Promise<unknown>[] = [];

  for (const integration of integrations) {
    const creds = (integration.credentials ?? {}) as Record<string, string>;
    const webhookUrl = integration.webhook_url ?? creds['webhook_url'] ?? '';

    switch (integration.type) {
      case 'telegram':
        handlers.push(fireTelegram(creds, payload).catch(() => null));
        break;
      case 'teams':
        handlers.push(fireTeams(webhookUrl, payload).catch(() => null));
        break;
      case 'n8n':
        handlers.push(fireN8n(webhookUrl, payload).catch(() => null));
        break;
      case 'google_calendar':
        handlers.push(fireGoogleCalendar(creds, payload).catch(() => null));
        break;
    }
  }

  await Promise.allSettled(handlers);
}
