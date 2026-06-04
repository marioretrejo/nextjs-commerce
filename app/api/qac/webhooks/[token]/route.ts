/**
 * QA Center — Universal Webhook Receiver
 *
 * Receives call-completed events from ANY VoIP platform:
 *   Twilio, Squaretalk, Voiso, Genesys, RingCentral, custom SIP trunks, etc.
 *
 * URL: POST /api/qac/webhooks/{workspace_webhook_token}
 *
 * Setup:
 *   1. Go to QA Center → Integrations and copy your webhook URL
 *   2. Configure field mappings to match your provider's payload shape
 *   3. Paste the URL as the call-completed / recording-ready callback in your VoIP platform
 *
 * Field mapping engine:
 *   Each VoiceOS field has an ordered list of candidate keys. The extractor tries
 *   each key in order and returns the first non-empty value. Workspace admins can
 *   override mappings via the Integrations UI or PATCH /api/qac/integrations.
 *
 * Default mappings cover Twilio, Squaretalk, Voiso, and generic SIP platforms.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// ─── Default field mappings (used when workspace hasn't customised) ────────────
// Ordered: first non-empty match wins. Keys are case-sensitive — providers vary.

const DEFAULT_MAPPINGS: Record<string, string[]> = {
  recording_url:  ['RecordingUrl', 'recording_url', 'audioUrl', 'audio_url', 'recordingUrl', 'file_url', 'mp3_url', 'wav_url'],
  agent_name:     ['agent_name', 'To', 'user_name', 'extension', 'sip_user', 'called_number', 'callee', 'agent', 'dst'],
  customer_phone: ['From', 'caller_id', 'customer_phone', 'ani', 'calling_number', 'callerNumber', 'src', 'clid'],
  call_id:        ['CallSid', 'call_id', 'callId', 'session_id', 'external_call_id', 'call_uuid', 'uniqueid', 'id'],
  duration:       ['RecordingDuration', 'duration', 'call_duration', 'callDuration', 'duration_seconds', 'length', 'billsec'],
  transcript:     ['transcript', 'transcription', 'text', 'call_transcript', 'body'],
  agent_id:       ['agent_id', 'user_id', 'extension_id', 'sip_user_id', 'agent_ext', 'operator_id'],
  direction:      ['direction', 'call_direction', 'callDirection', 'call_type', 'type'],
  outcome:        ['outcome', 'call_outcome', 'disposition', 'hangup_cause', 'status', 'lastapp'],
  language:       ['language', 'lang', 'transcript_lang', 'locale'],
  customer_name:  ['customer_name', 'contact_name', 'callerName', 'caller_name', 'customer'],
};

// ─── Integration type ─────────────────────────────────────────────────────────

interface QACIntegration {
  id:                  string;
  workspace_id:        string;
  twilio_account_sid:  string | null;
  twilio_auth_token:   string | null;
  auto_analyze:        boolean;
  agent_name_field:    string;
  is_active:           boolean;
  field_mappings:      Record<string, string[]> | null;
  provider_name:       string | null;
}

// ─── Universal field extractor ────────────────────────────────────────────────

/**
 * Extract a VoiceOS field from a flat payload using the configured (or default) mappings.
 * Returns the first non-null, non-empty string value found; null otherwise.
 */
function extract(
  payload: Record<string, unknown>,
  field: string,
  customMappings: Record<string, string[]> | null,
): string | null {
  // Merge: custom mappings override default, custom candidates come first
  const defaults = DEFAULT_MAPPINGS[field] ?? [];
  const custom   = customMappings?.[field] ?? [];
  const candidates = custom.length > 0 ? [...custom, ...defaults] : defaults;

  for (const key of candidates) {
    // Exact match
    const val = payload[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
    // Case-insensitive fallback (some providers inconsistently capitalise headers)
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(payload)) {
      if (k.toLowerCase() === lower && v !== undefined && v !== null && String(v).trim() !== '') {
        return String(v).trim();
      }
    }
  }

  return null;
}

/**
 * Flatten nested objects one level deep so dot-notation keys like
 * "call.recording_url" work alongside top-level keys.
 */
function flattenPayload(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};

  const flat: Record<string, unknown> = { ...(raw as Record<string, unknown>) };

  for (const [k, v] of Object.entries(flat)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
        flat[`${k}.${nk}`] = nv;
        // Also hoist nested keys to top-level (providers vary)
        if (!(nk in flat)) flat[nk] = nv;
      }
    }
  }

  return flat;
}

// ─── Audio transcription ──────────────────────────────────────────────────────

async function transcribeAudio(
  recordingUrl:  string,
  accountSid:    string | null,
  authToken:     string | null,
  lang:          string = 'en',
): Promise<string | null> {
  const groqKey = process.env['GROQ_API_KEY'];
  if (!groqKey) return null;

  // Build full Twilio MP3 URL if not already .mp3 (Squaretalk/Voiso don't need this)
  const mp3Url = /\.(mp3|wav|ogg|m4a|flac)$/i.test(recordingUrl)
    ? recordingUrl
    : `${recordingUrl}.mp3`;

  const headers: Record<string, string> = {};
  if (accountSid && authToken) {
    headers['Authorization'] = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
  }

  let audioBuffer: Buffer;
  try {
    const audioRes = await fetch(mp3Url, { headers });
    if (!audioRes.ok) {
      console.error('[qac-webhook] Recording download failed:', audioRes.status, mp3Url);
      return null;
    }
    audioBuffer = Buffer.from(await audioRes.arrayBuffer());
  } catch (err) {
    console.error('[qac-webhook] Recording download error:', err);
    return null;
  }

  // Detect content type from URL extension for Groq Whisper
  const ext = (mp3Url.match(/\.(mp3|wav|ogg|m4a|flac)$/i)?.[1] ?? 'mp3').toLowerCase();
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
  };

  try {
    const form = new globalThis.FormData();
    form.append('file', new Blob([audioBuffer], { type: mimeMap[ext] ?? 'audio/mpeg' }), `recording.${ext}`);
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'text');
    form.append('language', lang);

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
    });

    if (!whisperRes.ok) {
      console.error('[qac-webhook] Whisper error:', whisperRes.status, await whisperRes.text());
      return null;
    }

    return (await whisperRes.text()).trim();
  } catch (err) {
    console.error('[qac-webhook] Transcription error:', err);
    return null;
  }
}

// ─── Background QA analysis ───────────────────────────────────────────────────

async function runQAAnalysis(interactionId: string, workspaceId: string) {
  const baseUrl = process.env['NEXTAUTH_URL']
    ?? (process.env['VERCEL_URL'] ? `https://${process.env['VERCEL_URL']}` : 'http://localhost:3000');

  const res = await fetch(`${baseUrl}/api/qac/interactions/${interactionId}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-workspace-id':    workspaceId,
      'x-internal-secret': process.env['INTERNAL_API_SECRET'] ?? '',
    },
  });

  if (!res.ok) {
    console.error('[qac-webhook] Auto-analyze failed:', res.status, await res.text());
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return new NextResponse('Bad Request', { status: 400 });

  const admin = createAdminClient();

  // Resolve workspace by webhook token
  const { data: integData } = await admin
    .from('qac_integrations')
    .select('id, workspace_id, twilio_account_sid, twilio_auth_token, auto_analyze, agent_name_field, is_active, field_mappings, provider_name')
    .eq('webhook_token', token)
    .single();

  const integration = integData as QACIntegration | null;
  if (!integration || !integration.is_active) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  const contentType = req.headers.get('content-type') ?? '';
  let rawPayload: unknown = {};

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await req.formData();
    const obj: Record<string, string> = {};
    for (const [key, value] of formData.entries()) obj[key] = String(value);
    rawPayload = obj;
  } else if (contentType.includes('application/json')) {
    rawPayload = await req.json();
  } else {
    try {
      const formData = await req.formData();
      const obj: Record<string, string> = {};
      for (const [key, value] of formData.entries()) obj[key] = String(value);
      rawPayload = obj;
    } catch {
      rawPayload = {};
    }
  }

  // Flatten nested objects so "call.recording_url" works
  const payload = flattenPayload(rawPayload);
  const mappings = integration.field_mappings;

  // ── Extract fields via mapping engine ──────────────────────────────────────
  const recordingUrl   = extract(payload, 'recording_url',  mappings);
  const callId         = extract(payload, 'call_id',        mappings);
  const fromNumber     = extract(payload, 'customer_phone', mappings);
  const duration       = extract(payload, 'duration',       mappings);
  const direction      = extract(payload, 'direction',      mappings);
  const outcome        = extract(payload, 'outcome',        mappings);
  const language       = extract(payload, 'language',       mappings) ?? 'en';
  const customerName   = extract(payload, 'customer_name',  mappings);
  let   transcript     = extract(payload, 'transcript',     mappings);

  // Agent name: try custom mapping first, then fall back to the per-integration
  // agent_name_field setting (which maps To/From/etc. for Twilio compatibility)
  let agentName = extract(payload, 'agent_name', mappings);
  if (!agentName) {
    const fallbackField = integration.agent_name_field ?? 'To';
    const fallbackVal = payload[fallbackField];
    agentName = fallbackVal ? String(fallbackVal) : null;
  }
  if (!agentName) agentName = callId ?? 'Unknown Agent';

  const agentId = extract(payload, 'agent_id', mappings);

  // Log extracted values for debugging (masked)
  console.info('[qac-webhook] Extracted fields:', {
    provider: integration.provider_name ?? 'unknown',
    workspace: integration.workspace_id,
    has_recording: !!recordingUrl,
    has_transcript: !!transcript,
    agent: agentName,
    duration,
    language,
  });

  // ── Transcription ──────────────────────────────────────────────────────────
  if (!transcript && recordingUrl) {
    transcript = await transcribeAudio(
      recordingUrl,
      integration.twilio_account_sid,
      integration.twilio_auth_token,
      language,
    );
  }

  if (!transcript || transcript.trim().length < 20) {
    console.warn('[qac-webhook] No usable transcript for call:', callId);
    // Return 200 so the provider doesn't retry endlessly
    return NextResponse.json({ ok: false, reason: 'no_transcript' });
  }

  // Normalise direction to 'inbound'/'outbound'/'unknown'
  let normDirection: 'inbound' | 'outbound' = 'inbound';
  if (direction) {
    const d = direction.toLowerCase();
    if (d.includes('out') || d === 'outbound' || d === 'egress') normDirection = 'outbound';
  }

  // ── Persist interaction ────────────────────────────────────────────────────
  const { data: interactionData, error: intErr } = await admin
    .from('qac_interactions')
    .insert({
      workspace_id:    integration.workspace_id,
      agent_name:      String(agentName).slice(0, 200),
      agent_id:        agentId ?? callId ?? null,
      channel:         'call',
      direction:       normDirection,
      transcript:      transcript.trim(),
      duration_s:      duration ? Math.round(Number(duration)) : null,
      audio_url:       recordingUrl ?? null,
      language,
      customer_phone:  fromNumber ?? null,
      customer_name:   customerName ?? null,
      outcome:         outcome ?? null,
      status:          'pending',
      metadata: {
        source:       integration.provider_name ?? 'webhook',
        call_id:      callId,
        raw_keys:     Object.keys(payload).slice(0, 30), // first 30 keys for debugging
      },
    })
    .select('id')
    .single();

  if (intErr || !interactionData) {
    console.error('[qac-webhook] DB insert failed:', intErr?.message);
    return NextResponse.json({ ok: false, reason: 'db_error' }, { status: 500 });
  }

  const interactionId = (interactionData as { id: string }).id;

  if (integration.auto_analyze) {
    void runQAAnalysis(interactionId, integration.workspace_id).catch(err =>
      console.error('[qac-webhook] Background analysis error:', err)
    );
  }

  return NextResponse.json({ ok: true, interaction_id: interactionId });
}
