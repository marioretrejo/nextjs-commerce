import { getCdrAdapter } from "@/lib/qac/adapters";
import {
  findOrCreateQacAgent,
  findQacDepartment,
} from "@/lib/qac/department-matching";
import { uploadQacRecording } from "@/lib/qac/audio-storage";
import { processQacBacklog, processQacInteraction } from "@/lib/qac/pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";

interface ProviderRow {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  type: string;
  webhook_secret: string | null;
  config_json: unknown;
  is_active: boolean;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function readSecret(req: Request, url: URL): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice("bearer ".length).trim();
  }
  return (
    req.headers.get("x-qac-secret") ??
    req.headers.get("x-webhook-secret") ??
    url.searchParams.get("secret")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPayloadSecret(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  for (const key of ["api_key", "apiKey", "webhook_secret", "secret"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const metadata = payload["metadata"];
  if (isRecord(metadata)) {
    for (const key of ["api_key", "apiKey", "webhook_secret", "secret"]) {
      const value = metadata[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }

  return null;
}

async function readPayload(req: Request): Promise<unknown> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return req.json();
  }
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await req.formData();
    return Object.fromEntries(
      [...form.entries()].map(([key, value]) => [
        key,
        typeof value === "string" ? value : value.name,
      ]),
    );
  }
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { body: text };
  }
}

function parseConfig(config: unknown): {
  field_mappings?: Record<string, string[]>;
  auto_analyze?: boolean;
} {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return {};
  }
  return config as {
    field_mappings?: Record<string, string[]>;
    auto_analyze?: boolean;
  };
}

function missingColumn(errorMessage?: string | null): boolean {
  const message = errorMessage ?? "";
  return message.includes("Could not find") || message.includes("schema cache");
}

function statusConstraint(errorMessage?: string | null): boolean {
  const message = errorMessage ?? "";
  return (
    message.includes("qac_interactions_status_check") ||
    message.includes("violates check constraint")
  );
}

function legacyStatus(status: string): string {
  return ["pending", "analyzing", "analyzed", "failed"].includes(status)
    ? status
    : "pending";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerSlug } = await params;
  const url = new URL(req.url);
  const rawPayload = await readPayload(req);
  const secret = readSecret(req, url) ?? readPayloadSecret(rawPayload);

  if (!secret) {
    return NextResponse.json(
      { error: "Missing QA Center webhook secret" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  const { data: providerRows, error: providerError } = await admin
    .from("qac_voip_providers")
    .select("*")
    .eq("slug", providerSlug)
    .eq("is_active", true);

  if (providerError) {
    return NextResponse.json({ error: providerError.message }, { status: 500 });
  }

  const provider = ((providerRows as ProviderRow[] | null) ?? []).find(
    (row) => row.webhook_secret && safeEqual(row.webhook_secret, secret),
  );

  if (!provider) {
    return NextResponse.json(
      { error: "Invalid QA Center provider or secret" },
      { status: 401 },
    );
  }

  const config = parseConfig(provider.config_json);
  const adapter = getCdrAdapter(provider.type);
  const normalized = adapter.normalize(rawPayload, {
    providerSlug: provider.slug,
    mappings: config.field_mappings ?? null,
  });

  if (!normalized.external_call_id) {
    await admin.from("qac_ingestion_logs").insert({
      workspace_id: provider.workspace_id,
      provider_id: provider.id,
      status: "failed",
      error_message: "Missing external_call_id after provider normalization",
      raw_payload: normalized.raw_payload,
    });
    return NextResponse.json(
      { error: "Missing external_call_id" },
      { status: 422 },
    );
  }

  const { data: existing } = await admin
    .from("qac_interactions")
    .select("id, status, department_id, recording_url, internal_audio_url")
    .eq("workspace_id", provider.workspace_id)
    .eq("provider_id", provider.id)
    .eq("external_call_id", normalized.external_call_id)
    .maybeSingle();

  if (existing) {
    const existingInteraction = existing as {
      id: string;
      status: string;
      department_id: string | null;
      recording_url: string | null;
      internal_audio_url: string | null;
    };
    const department = existingInteraction.department_id
      ? null
      : await findQacDepartment(admin, provider.workspace_id, normalized);
    const shouldStoreIncomingAudio = Boolean(
      normalized.recording_base64 || !existingInteraction.internal_audio_url,
    );
    const storedAudio = shouldStoreIncomingAudio
      ? await uploadQacRecording({
          admin,
          workspaceId: provider.workspace_id,
          providerSlug: provider.slug,
          externalCallId: normalized.external_call_id,
          recordingBase64: normalized.recording_base64,
          recordingUrl: normalized.recording_url,
        })
      : { storagePath: existingInteraction.internal_audio_url, error: null };
    const departmentId =
      existingInteraction.department_id ?? department?.id ?? null;
    const audioPath =
      storedAudio.storagePath ?? existingInteraction.internal_audio_url;
    const hasAudio = Boolean(audioPath || existingInteraction.recording_url);
    const shouldAnalyze =
      (config.auto_analyze ?? true) &&
      (department?.auto_analyze ?? true) &&
      Boolean(departmentId) &&
      hasAudio &&
      !["analyzing", "analyzed"].includes(existingInteraction.status);
    const nextStatus =
      hasAudio &&
      [
        "failed_audio",
        "failed_transcription",
        "failed_analysis",
        "transcribing",
        "analyzing",
      ].includes(existingInteraction.status)
        ? "audio_ready"
        : existingInteraction.status;

    await admin
      .from("qac_interactions")
      .update({
        department_id: departmentId,
        department_name: department?.name ?? normalized.department_name,
        recording_url:
          existingInteraction.recording_url ?? normalized.recording_url,
        internal_audio_url: audioPath,
        status: nextStatus,
      })
      .eq("id", existingInteraction.id);

    await admin.from("qac_ingestion_logs").insert({
      workspace_id: provider.workspace_id,
      provider_id: provider.id,
      external_call_id: normalized.external_call_id,
      status: "duplicate",
      raw_payload: normalized.raw_payload,
    });
    if (shouldAnalyze) {
      after(async () => {
        await processQacInteraction(existingInteraction.id);
        await processQacBacklog({
          workspaceId: provider.workspace_id,
          limit: 3,
        });
      });
    }
    return NextResponse.json({
      ok: true,
      duplicate: true,
      interaction_id: existingInteraction.id,
      status: existingInteraction.status,
      analysis_queued: shouldAnalyze,
      audio_saved: Boolean(audioPath),
      audio_storage_error: storedAudio.error,
      normalized_department_name: normalized.department_name,
      department_id: departmentId,
    });
  }

  const department = await findQacDepartment(
    admin,
    provider.workspace_id,
    normalized,
  );
  const agent = await findOrCreateQacAgent(
    admin,
    provider.workspace_id,
    normalized,
    department?.id ?? null,
  );
  const storedAudio = await uploadQacRecording({
    admin,
    workspaceId: provider.workspace_id,
    providerSlug: provider.slug,
    externalCallId: normalized.external_call_id,
    recordingBase64: normalized.recording_base64,
    recordingUrl: normalized.recording_url,
  });

  const hasTranscript = Boolean(normalized.transcript?.trim());
  const hasAudio = Boolean(storedAudio.storagePath || normalized.recording_url);
  const disposition = normalized.disposition?.toLowerCase() ?? "";
  const notEvaluableWithoutAudio =
    !hasAudio &&
    !hasTranscript &&
    (disposition.includes("no answer") ||
      disposition.includes("busy") ||
      disposition.includes("failed") ||
      disposition.includes("cancel"));
  const status = !department
    ? "manual_review_required"
    : hasTranscript
      ? "transcribed"
      : hasAudio
        ? "audio_ready"
        : notEvaluableWithoutAudio
          ? "not_evaluable"
          : "pending_audio";

  const title =
    normalized.caller_id ??
    normalized.prospect_id ??
    normalized.external_call_id ??
    "CDR interaction";
  const legacyAgentName =
    normalized.agent_name ??
    normalized.agent_extension ??
    normalized.external_agent_id ??
    "Unknown Agent";
  const legacyTranscript = normalized.transcript ?? "";

  const insertPayload = {
    workspace_id: provider.workspace_id,
    provider_id: provider.id,
    provider: provider.slug,
    external_call_id: normalized.external_call_id,
    agent_id: agent?.id ?? null,
    agent_name: legacyAgentName,
    agent_extension: normalized.agent_extension,
    department_id: department?.id ?? null,
    department_name: normalized.department_name,
    caller_id: normalized.caller_id,
    prospect_id: normalized.prospect_id,
    interaction_title: title,
    recording_url: normalized.recording_url,
    internal_audio_url: storedAudio.storagePath,
    audio_url: normalized.recording_url,
    duration_seconds: normalized.duration_seconds,
    duration_s: normalized.duration_seconds,
    direction: normalized.direction,
    disposition: normalized.disposition,
    call_started_at: normalized.call_started_at,
    call_ended_at: normalized.call_ended_at,
    started_at: normalized.call_started_at,
    channel: "call",
    transcript: legacyTranscript,
    status,
    review_status: "pending_review",
    raw_payload: normalized.raw_payload,
    source_payload: normalized.raw_payload,
  };
  const legacyInsertPayload = {
    workspace_id: provider.workspace_id,
    agent_name: legacyAgentName,
    channel: "call",
    transcript: legacyTranscript,
    audio_url: normalized.recording_url,
    duration_s: normalized.duration_seconds,
    status: legacyStatus(status),
    metadata: {
      ...normalized.raw_payload,
      external_call_id: normalized.external_call_id,
      provider_id: provider.id,
      provider: provider.slug,
      caller_id: normalized.caller_id,
      prospect_id: normalized.prospect_id,
      department_name: normalized.department_name,
      disposition: normalized.disposition,
      call_started_at: normalized.call_started_at,
      internal_audio_url: storedAudio.storagePath,
      audio_storage_error: storedAudio.error,
    },
  };

  let insertResult = await admin
    .from("qac_interactions")
    .insert(insertPayload)
    .select("id, status")
    .single();

  if (missingColumn(insertResult.error?.message)) {
    insertResult = await admin
      .from("qac_interactions")
      .insert(legacyInsertPayload)
      .select("id, status")
      .single();
  }

  if (statusConstraint(insertResult.error?.message)) {
    insertResult = await admin
      .from("qac_interactions")
      .insert({
        ...insertPayload,
        status: status === "pending_audio" ? "pending" : "pending_audio",
      })
      .select("id, status")
      .single();
  }

  if (statusConstraint(insertResult.error?.message)) {
    insertResult = await admin
      .from("qac_interactions")
      .insert(legacyInsertPayload)
      .select("id, status")
      .single();
  }

  const { data: inserted, error: insertError } = insertResult;

  if (insertError || !inserted) {
    await admin.from("qac_ingestion_logs").insert({
      workspace_id: provider.workspace_id,
      provider_id: provider.id,
      external_call_id: normalized.external_call_id,
      status: "failed",
      error_message: insertError?.message ?? "Interaction insert failed",
      raw_payload: normalized.raw_payload,
    });
    return NextResponse.json(
      { error: insertError?.message ?? "Interaction insert failed" },
      { status: 500 },
    );
  }

  const interactionId = (inserted as { id: string }).id;

  if (hasTranscript) {
    await admin.from("qac_transcripts").insert({
      workspace_id: provider.workspace_id,
      interaction_id: interactionId,
      full_text: normalized.transcript,
      diarized_json: [],
      provider: provider.slug,
    });
  }

  await admin.from("qac_ingestion_logs").insert({
    workspace_id: provider.workspace_id,
    provider_id: provider.id,
    external_call_id: normalized.external_call_id,
    status: "created",
    raw_payload: normalized.raw_payload,
  });

  const shouldAnalyze =
    (config.auto_analyze ?? true) &&
    (department?.auto_analyze ?? true) &&
    status !== "manual_review_required" &&
    (hasTranscript || hasAudio);

  if (shouldAnalyze) {
    after(async () => {
      const result = await processQacInteraction(interactionId);
      await processQacBacklog({
        workspaceId: provider.workspace_id,
        limit: 3,
      });
      if (!result.ok) {
        await admin.from("qac_ingestion_logs").insert({
          workspace_id: provider.workspace_id,
          provider_id: provider.id,
          external_call_id: normalized.external_call_id,
          status: result.status,
          error_message: result.error ?? null,
          raw_payload: normalized.raw_payload,
        });
      }
    });
  }

  return NextResponse.json(
    {
      ok: true,
      interaction_id: interactionId,
      status,
      analysis_queued: shouldAnalyze,
      audio_saved: Boolean(storedAudio.storagePath),
      audio_storage_error: storedAudio.error,
      normalized_department_name: normalized.department_name,
      department_id: department?.id ?? null,
      agent_id: agent?.id ?? null,
    },
    { status: 201 },
  );
}
