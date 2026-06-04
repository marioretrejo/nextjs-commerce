/**
 * QA Center — Universal Webhook Receiver
 * Receives call-completed events from Twilio (and compatible platforms).
 * URL: POST /api/qac/webhooks/{workspace_webhook_token}
 *
 * Twilio setup:
 *   1. Enable "Record Calls" in your Twilio number settings (or via TwiML)
 *   2. Set the Recording Status Callback URL to this endpoint
 *   3. Paste your Twilio Account SID + Auth Token in QA Center → Integrations
 *
 * Flow:
 *   Twilio sends POST → verify token → download recording → Groq Whisper
 *   → create qac_interaction → auto-analyze with active QA rules → score + flags
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

interface TwilioPayload {
  CallSid?:             string;
  RecordingUrl?:        string;
  RecordingSid?:        string;
  RecordingDuration?:   string;
  From?:                string;
  To?:                  string;
  CallStatus?:          string;
  RecordingStatus?:     string;
  AccountSid?:          string;
  // Generic / other platforms
  recording_url?:       string;
  agent_name?:          string;
  duration_seconds?:    string;
  transcript?:          string;
}

interface QACIntegration {
  id: string;
  workspace_id: string;
  twilio_account_sid: string | null;
  twilio_auth_token:  string | null;
  auto_analyze:       boolean;
  agent_name_field:   string;
  is_active:          boolean;
}

async function transcribeAudio(
  recordingUrl:  string,
  accountSid:    string | null,
  authToken:     string | null,
): Promise<string | null> {
  const groqKey = process.env['GROQ_API_KEY'];
  if (!groqKey) return null;

  // Build full Twilio MP3 URL if not already .mp3
  const mp3Url = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`;

  // Download the recording (with auth if Twilio credentials are provided)
  const headers: Record<string, string> = {};
  if (accountSid && authToken) {
    headers['Authorization'] = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
  }

  let audioBuffer: Buffer;
  try {
    const audioRes = await fetch(mp3Url, { headers });
    if (!audioRes.ok) {
      console.error('[qac-webhook] Failed to download recording:', audioRes.status, mp3Url);
      return null;
    }
    audioBuffer = Buffer.from(await audioRes.arrayBuffer());
  } catch (err) {
    console.error('[qac-webhook] Recording download error:', err);
    return null;
  }

  // Send to Groq Whisper for transcription using Web API FormData
  try {
    const form = new globalThis.FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    form.append('file', blob, 'recording.mp3');
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'text');
    form.append('language', 'en');

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.text();
      console.error('[qac-webhook] Whisper error:', whisperRes.status, err);
      return null;
    }

    return (await whisperRes.text()).trim();
  } catch (err) {
    console.error('[qac-webhook] Transcription error:', err);
    return null;
  }
}

async function runQAAnalysis(interactionId: string, workspaceId: string) {
  const baseUrl = process.env['NEXTAUTH_URL'] ?? process.env['VERCEL_URL']
    ? `https://${process.env['VERCEL_URL']}`
    : 'http://localhost:3000';

  const secret = process.env['INTERNAL_API_SECRET'] ?? '';

  // Re-use the existing analyze endpoint (same service account credentials)
  const res = await fetch(`${baseUrl}/api/qac/interactions/${interactionId}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-workspace-id': workspaceId,
      'x-internal-secret': secret,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[qac-webhook] Auto-analyze failed:', res.status, err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return new NextResponse('Bad Request', { status: 400 });

  const admin = createAdminClient();

  // Resolve workspace by webhook token
  const { data: integData } = await admin
    .from('qac_integrations')
    .select('id, workspace_id, twilio_account_sid, twilio_auth_token, auto_analyze, agent_name_field, is_active')
    .eq('webhook_token', token)
    .single();

  const integration = integData as QACIntegration | null;
  if (!integration || !integration.is_active) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // Parse body — Twilio sends application/x-www-form-urlencoded
  const contentType = req.headers.get('content-type') ?? '';
  let payload: TwilioPayload = {};

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await req.formData();
    for (const [key, value] of formData.entries()) {
      (payload as Record<string, string>)[key] = String(value);
    }
  } else if (contentType.includes('application/json')) {
    payload = await req.json() as TwilioPayload;
  } else {
    // Try form data anyway
    try {
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        (payload as Record<string, string>)[key] = String(value);
      }
    } catch {
      payload = {};
    }
  }

  // Extract fields — support both Twilio format and generic webhooks
  const recordingUrl  = payload.RecordingUrl  ?? payload.recording_url ?? null;
  const callSid       = payload.CallSid       ?? null;
  const duration      = payload.RecordingDuration ?? payload.duration_seconds ?? null;
  const fromNumber    = payload.From          ?? null;
  const toNumber      = payload.To            ?? null;

  // Determine agent name from configured field
  const agentNameField = integration.agent_name_field ?? 'To';
  const agentName = payload.agent_name
    ?? (agentNameField === 'From' ? fromNumber : toNumber)
    ?? callSid
    ?? 'Unknown Agent';

  // If a pre-built transcript was provided (some platforms send text directly), use it
  let transcript = payload.transcript ?? null;

  // If no transcript, try downloading + transcribing the recording
  if (!transcript && recordingUrl) {
    transcript = await transcribeAudio(
      recordingUrl,
      integration.twilio_account_sid,
      integration.twilio_auth_token,
    );
  }

  if (!transcript || transcript.trim().length < 20) {
    console.warn('[qac-webhook] No usable transcript for call:', callSid);
    // Return 200 so Twilio doesn't retry endlessly
    return NextResponse.json({ ok: false, reason: 'no_transcript' });
  }

  // Create the qac_interaction
  const { data: interactionData, error: intErr } = await admin
    .from('qac_interactions')
    .insert({
      workspace_id:  integration.workspace_id,
      agent_name:    String(agentName).slice(0, 100),
      agent_id:      callSid ?? null,
      channel:       'call',
      transcript:    transcript.trim(),
      duration_s:    duration ? Number(duration) : null,
      audio_url:     recordingUrl ?? null,
      status:        'pending',
      metadata: {
        source:     'twilio_webhook',
        call_sid:   callSid,
        from:       fromNumber,
        to:         toNumber,
      },
    })
    .select('id')
    .single();

  if (intErr || !interactionData) {
    console.error('[qac-webhook] Failed to save interaction:', intErr?.message);
    return NextResponse.json({ ok: false, reason: 'db_error' });
  }

  const interactionId = (interactionData as { id: string }).id;

  // Auto-analyze in background (non-blocking — fire and forget)
  if (integration.auto_analyze) {
    void runQAAnalysis(interactionId, integration.workspace_id).catch(err =>
      console.error('[qac-webhook] Background analysis error:', err)
    );
  }

  return NextResponse.json({ ok: true, interaction_id: interactionId });
}
