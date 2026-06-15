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
 *   2. Set provider_name to match your platform (e.g. "squaretalk")
 *   3. Configure field mappings if using the generic adapter
 *   4. Paste the URL as the call-completed / recording-ready callback in your VoIP platform
 *
 * Provider adapters (lib/qac/voip-adapters.ts):
 *   squaretalk — dedicated adapter with full Squaretalk metadata mapping
 *   generic    — field-mapping engine for Twilio, Voiso, Genesys, custom SIP
 *
 * Security:
 *   - Auth: workspace-scoped secret token in the URL path
 *   - Recording URLs validated against SSRF blocklist before fetch
 *   - Sensitive keys (api_key, token, secret, password, …) stripped from source_payload
 *
 * Idempotency:
 *   - Duplicate events (provider retries) are detected by (workspace, provider, external_call_id)
 *   - Returns 200 with { ok: true, duplicate: true } on repeat delivery
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, upsertCustomer } from "@/lib/qac-customer";
import {
  getAdapter,
  flattenPayload,
  sanitizePayload,
  type NormalizedExternalCall,
} from "@/lib/qac/voip-adapters";
import { isSafeUrl } from "@/lib/qac/ssrf";
import { after } from "next/server";
import { NextResponse } from "next/server";

// ─── Integration type ─────────────────────────────────────────────────────────

interface QACIntegration {
  id: string;
  workspace_id: string;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  auto_analyze: boolean;
  agent_name_field: string;
  is_active: boolean;
  field_mappings: Record<string, string[]> | null;
  provider_name: string | null;
}

// ─── Diarization types ───────────────────────────────────────────────────────

interface DeepgramUtterance {
  speaker: number;
  start: number;
  end: number;
  confidence: number;
  transcript: string;
}

interface DeepgramResponse {
  results?: {
    channels?: Array<{ alternatives?: Array<{ transcript?: string }> }>;
    utterances?: DeepgramUtterance[];
  };
}

export interface DiarizedTranscript {
  provider: "deepgram";
  model: "nova-3";
  language: string;
  utterances: Array<{
    speaker: string;
    speaker_type: "unknown";
    text: string;
    start_ms: number;
    end_ms: number;
    confidence: number;
  }>;
}

// ─── Audio transcription with Deepgram diarization + Groq Whisper fallback ───

async function transcribeWithDiarization(
  recordingUrl: string,
  accountSid: string | null,
  authToken: string | null,
  lang: string = "en",
): Promise<{ transcript: string; diarizedTranscript: DiarizedTranscript | null }> {
  const mp3Url = /\.(mp3|wav|ogg|m4a|flac)$/i.test(recordingUrl)
    ? recordingUrl
    : `${recordingUrl}.mp3`;

  const downloadHeaders: Record<string, string> = {};
  if (accountSid && authToken) {
    downloadHeaders["Authorization"] =
      `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
  }

  let audioBuffer: Buffer;
  try {
    const audioRes = await fetch(mp3Url, { headers: downloadHeaders });
    if (!audioRes.ok) {
      console.error(
        "[qac-webhook] Recording download failed:",
        audioRes.status,
        mp3Url,
      );
      return { transcript: "", diarizedTranscript: null };
    }
    audioBuffer = Buffer.from(await audioRes.arrayBuffer());
  } catch (err) {
    console.error("[qac-webhook] Recording download error:", err);
    return { transcript: "", diarizedTranscript: null };
  }

  const ext = (
    mp3Url.match(/\.(mp3|wav|ogg|m4a|flac)$/i)?.[1] ?? "mp3"
  ).toLowerCase();
  const mimeMap: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    flac: "audio/flac",
  };
  const contentType = mimeMap[ext] ?? "audio/mpeg";

  // ── 1. Deepgram nova-3 with diarization ───────────────────────────────────
  const deepgramKey = process.env["DEEPGRAM_API_KEY"];
  if (deepgramKey) {
    try {
      const dgRes = await fetch(
        `https://api.deepgram.com/v1/listen?model=nova-3&diarize=true&utterances=true&punctuate=true&language=${lang}`,
        {
          method: "POST",
          headers: {
            Authorization: `Token ${deepgramKey}`,
            "Content-Type": contentType,
          },
          body: audioBuffer,
        },
      );

      if (dgRes.ok) {
        const dgData = (await dgRes.json()) as DeepgramResponse;
        const plainTranscript =
          dgData.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";

        if (plainTranscript.length >= 20) {
          const rawUtterances = dgData.results?.utterances ?? [];
          const utterances = rawUtterances.map((u) => ({
            speaker: String(u.speaker),
            speaker_type: "unknown" as const,
            text: u.transcript ?? "",
            start_ms: Math.round((u.start ?? 0) * 1000),
            end_ms: Math.round((u.end ?? 0) * 1000),
            confidence: u.confidence ?? 0,
          }));

          console.info(
            "[qac-webhook] Deepgram diarization success:",
            utterances.length,
            "utterances",
          );

          return {
            transcript: plainTranscript,
            diarizedTranscript:
              utterances.length > 0
                ? { provider: "deepgram", model: "nova-3", language: lang, utterances }
                : null,
          };
        }
      } else {
        console.error(
          "[qac-webhook] Deepgram error:",
          dgRes.status,
          await dgRes.text(),
        );
      }
    } catch (err) {
      console.error("[qac-webhook] Deepgram transcription error:", err);
    }
  }

  // ── 2. Fallback: Groq Whisper (no diarization) ────────────────────────────
  const groqKey = process.env["GROQ_API_KEY"];
  if (!groqKey) return { transcript: "", diarizedTranscript: null };

  try {
    const form = new globalThis.FormData();
    form.append(
      "file",
      new Blob([audioBuffer], { type: contentType }),
      `recording.${ext}`,
    );
    form.append("model", "whisper-large-v3-turbo");
    form.append("response_format", "text");
    form.append("language", lang);

    const whisperRes = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}` },
        body: form,
      },
    );

    if (!whisperRes.ok) {
      console.error(
        "[qac-webhook] Whisper fallback error:",
        whisperRes.status,
        await whisperRes.text(),
      );
      return { transcript: "", diarizedTranscript: null };
    }

    console.info("[qac-webhook] Groq Whisper fallback used (no diarization)");
    return { transcript: (await whisperRes.text()).trim(), diarizedTranscript: null };
  } catch (err) {
    console.error("[qac-webhook] Groq fallback error:", err);
    return { transcript: "", diarizedTranscript: null };
  }
}

// ─── Background QA analysis ───────────────────────────────────────────────────

async function runQAAnalysis(interactionId: string, workspaceId: string) {
  const secret = process.env["INTERNAL_API_SECRET"];
  if (!secret || secret.trim().length < 16) {
    console.error(
      "[qac-webhook] Cannot run auto-analyze: INTERNAL_API_SECRET is not configured or too short",
    );
    return;
  }

  const baseUrl =
    process.env["NEXTAUTH_URL"] ??
    (process.env["VERCEL_URL"]
      ? `https://${process.env["VERCEL_URL"]}`
      : "http://localhost:3000");

  const res = await fetch(
    `${baseUrl}/api/qac/interactions/${interactionId}/analyze`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": workspaceId,
        "x-internal-secret": secret,
      },
    },
  );

  if (!res.ok) {
    console.error(
      "[qac-webhook] Auto-analyze failed:",
      res.status,
      await res.text(),
    );
  }
}

// ─── Department resolver ──────────────────────────────────────────────────────

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeLike(s: string): string {
  // Escape SQL LIKE special chars to prevent wildcard injection
  return s.replace(/[%_\\]/g, "\\$&");
}

async function resolveDepartmentId(
  adminClient: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  departmentName: string | null,
  agentExtension: string | null,
): Promise<string | null> {
  // 1. Match by department_name: slug exact first, then name ilike
  if (departmentName) {
    const slug = toSlug(departmentName);
    if (slug.length > 0) {
      const { data: bySlug } = await adminClient
        .from("qac_departments")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (bySlug) return (bySlug as { id: string }).id;
    }

    const safeName = escapeLike(departmentName.trim());
    if (safeName.length > 0) {
      const { data: byName } = await adminClient
        .from("qac_departments")
        .select("id")
        .eq("workspace_id", workspaceId)
        .ilike("name", safeName)
        .eq("is_active", true)
        .maybeSingle();
      if (byName) return (byName as { id: string }).id;
    }
  }

  // 2. Fallback: match by agent_extension
  if (agentExtension) {
    const { data: byExt } = await adminClient
      .from("qac_department_extensions")
      .select("department_id")
      .eq("workspace_id", workspaceId)
      .eq("agent_extension", agentExtension.trim())
      .maybeSingle();
    if (byExt) return (byExt as { department_id: string }).department_id;
  }

  return null;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) return new NextResponse("Bad Request", { status: 400 });

  const admin = createAdminClient();

  // Resolve workspace by webhook token
  const { data: integData } = await admin
    .from("qac_integrations")
    .select(
      "id, workspace_id, twilio_account_sid, twilio_auth_token, auto_analyze, agent_name_field, is_active, field_mappings, provider_name",
    )
    .eq("webhook_token", token)
    .single();

  const integration = integData as QACIntegration | null;
  if (!integration || !integration.is_active) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  const contentType = req.headers.get("content-type") ?? "";
  let rawPayload: unknown = {};

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await req.formData();
    const obj: Record<string, string> = {};
    for (const [key, value] of formData.entries()) obj[key] = String(value);
    rawPayload = obj;
  } else if (contentType.includes("application/json")) {
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

  // Flatten nested objects and dispatch to the correct provider adapter
  const payload = flattenPayload(rawPayload);
  const adapter = getAdapter(integration.provider_name);
  const normalized: NormalizedExternalCall = adapter.normalize(
    payload,
    integration.field_mappings,
  );

  // Override provider name with the integration's configured value when set
  // (GenericAdapter returns "generic"; use the real provider_name for storage)
  const providerName = integration.provider_name?.toLowerCase().trim() ?? normalized.provider;

  // Agent name fallback: integration.agent_name_field → external_call_id → "Unknown Agent"
  const agentName =
    normalized.agent_name ??
    ((): string | null => {
      const fallbackField = integration.agent_name_field ?? "To";
      const val = payload[fallbackField];
      return val ? String(val).trim() : null;
    })() ??
    normalized.external_call_id ??
    "Unknown Agent";

  // Log extracted fields (no secrets)
  console.info("[qac-webhook] Normalized call:", {
    provider: providerName,
    workspace: integration.workspace_id,
    external_call_id: normalized.external_call_id,
    has_recording: !!normalized.recording_url,
    has_transcript: !!normalized.transcript,
    agent: agentName,
    direction: normalized.direction,
    duration_s: normalized.duration_seconds,
    department: normalized.department_name,
  });

  // ── SSRF protection on recording URL ──────────────────────────────────────
  let safeRecordingUrl = normalized.recording_url;
  if (safeRecordingUrl && !isSafeUrl(safeRecordingUrl)) {
    console.warn(
      "[qac-webhook] Recording URL blocked by SSRF check:",
      safeRecordingUrl,
    );
    safeRecordingUrl = null;
  }

  // ── Idempotency — reject duplicate events from provider retries ───────────
  if (normalized.external_call_id && providerName !== "generic") {
    const { data: existing } = await admin
      .from("qac_interactions")
      .select("id")
      .eq("workspace_id", integration.workspace_id)
      .eq("provider", providerName)
      .eq("external_call_id", normalized.external_call_id)
      .maybeSingle();

    if (existing) {
      console.info(
        "[qac-webhook] Duplicate event ignored:",
        providerName,
        normalized.external_call_id,
      );
      return NextResponse.json({
        ok: true,
        interaction_id: (existing as { id: string }).id,
        duplicate: true,
      });
    }
  }

  // ── Transcription ──────────────────────────────────────────────────────────
  let transcript = normalized.transcript;
  let diarizedTranscript: DiarizedTranscript | null = null;
  const language = normalized.language;

  if (!transcript && safeRecordingUrl) {
    const result = await transcribeWithDiarization(
      safeRecordingUrl,
      integration.twilio_account_sid,
      integration.twilio_auth_token,
      language,
    );
    transcript = result.transcript || null;
    diarizedTranscript = result.diarizedTranscript;
  }

  if (!transcript || transcript.trim().length < 20) {
    console.warn(
      "[qac-webhook] No usable transcript for call:",
      normalized.external_call_id,
    );
    return NextResponse.json({ ok: false, reason: "no_transcript" });
  }

  // Normalise direction to schema values
  const normDirection: "inbound" | "outbound" =
    normalized.direction ?? "inbound";

  // Sanitize source payload for storage (strips api_key, secrets, etc.)
  const rawPayloadObj =
    typeof rawPayload === "object" && rawPayload !== null
      ? (rawPayload as Record<string, unknown>)
      : {};
  const sourcePayload = sanitizePayload(rawPayloadObj);

  // ── Resolve department ─────────────────────────────────────────────────────
  // Try department_name (from provider's agent_type / queue field) first,
  // then fall back to agent_extension mapping. Null means no match — the
  // interaction is still saved and analyzed using global default rules.
  const departmentId = await resolveDepartmentId(
    admin,
    integration.workspace_id,
    normalized.department_name,
    normalized.agent_extension,
  ).catch((err) => {
    console.error("[qac-webhook] Department resolution error:", err);
    return null;
  });

  if (departmentId) {
    console.info("[qac-webhook] Department resolved:", departmentId);
  }

  // ── Persist interaction ────────────────────────────────────────────────────
  const { data: interactionData, error: intErr } = await admin
    .from("qac_interactions")
    .insert({
      workspace_id: integration.workspace_id,
      agent_name: String(agentName).slice(0, 200),
      agent_id: normalized.agent_id ?? normalized.external_call_id ?? null,
      channel: "call",
      direction: normDirection,
      transcript: transcript.trim(),
      diarized_transcript: diarizedTranscript ?? null,
      duration_s:
        normalized.duration_seconds != null
          ? Math.round(normalized.duration_seconds)
          : null,
      audio_url: safeRecordingUrl ?? null,
      language,
      customer_phone: normalized.customer_phone ?? null,
      customer_name: normalized.customer_name ?? null,
      outcome: normalized.disposition ?? null,
      // External VoIP fields (migration 067)
      external_call_id: normalized.external_call_id ?? null,
      provider: providerName,
      talk_time_s:
        normalized.talk_time_seconds != null
          ? Math.round(normalized.talk_time_seconds)
          : null,
      started_at: normalized.started_at ?? null,
      department_name: normalized.department_name ?? null,
      department_id: departmentId,
      agent_extension: normalized.agent_extension ?? null,
      source_payload: sourcePayload,
      status: "pending",
      metadata: {
        source: providerName,
        call_id: normalized.external_call_id,
        unit_id: normalized.unit_id ?? undefined,
        unit_org_id: normalized.unit_org_id ?? undefined,
        raw_keys: Object.keys(payload).slice(0, 30),
      },
    })
    .select("id")
    .single();

  if (intErr || !interactionData) {
    console.error("[qac-webhook] DB insert failed:", intErr?.message);
    return NextResponse.json(
      { ok: false, reason: "db_error" },
      { status: 500 },
    );
  }

  const interactionId = (interactionData as { id: string }).id;

  if (integration.auto_analyze) {
    void runQAAnalysis(interactionId, integration.workspace_id).catch((err) =>
      console.error("[qac-webhook] Background analysis error:", err),
    );
  }

  after(() =>
    enrichCustomer(
      integration.workspace_id,
      interactionId,
      normalized.customer_phone ?? null,
      normalized.customer_name ?? null,
    ).catch((err) =>
      console.error("[qac-webhook] customer enrichment failed", err),
    ),
  );

  return NextResponse.json({ ok: true, interaction_id: interactionId });
}

async function enrichCustomer(
  workspaceId: string,
  interactionId: string,
  rawPhone: string | null,
  displayName: string | null,
): Promise<void> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return;

  const customer = await upsertCustomer({
    workspace_id: workspaceId,
    canonical_phone: phone,
    canonical_email: null,
    display_name: displayName ?? undefined,
  });

  if (!customer) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("qac_interactions")
    .update({ customer_id: customer.id })
    .eq("id", interactionId);

  if (error) {
    console.error("[qac-webhook] Failed to link customer_id:", error.message);
  }
}
