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
import {
  getAdapter,
  flattenPayload,
  sanitizePayload,
  type NormalizedExternalCall,
} from "@/lib/qac/voip-adapters";
import { isSafeUrl } from "@/lib/qac/ssrf";
import { after } from "next/server";
import { NextResponse } from "next/server";
import type { QACIntegration, DiarizedTranscript } from "./_lib/types";
import { transcribeWithDiarization } from "./_lib/transcription";
import {
  runQAAnalysis,
  resolveDepartmentId,
  enrichCustomer,
} from "./_lib/helpers";

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
  const providerName =
    integration.provider_name?.toLowerCase().trim() ?? normalized.provider;

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
