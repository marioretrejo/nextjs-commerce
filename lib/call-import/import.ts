import type { createAdminClient } from "@/lib/supabase/admin";
import type { CallProviderIntegration } from "@/lib/supabase/types";
import type { NormalizedExternalCall } from "./types";
import { uploadImportedRecording } from "./storage";

type Admin = ReturnType<typeof createAdminClient>;

export type ImportResult =
  | { status: "duplicate"; callId: string }
  | { status: "success"; callId: string }
  | { status: "error"; message: string };

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

// Map the imported call to an agent: explicit default → fuzzy name match.
async function resolveAgentId(
  admin: Admin,
  workspaceId: string,
  integration: Pick<CallProviderIntegration, "default_agent_id">,
  agentName: string | undefined,
): Promise<string | null> {
  if (integration.default_agent_id) {
    const { data } = await admin
      .from("agents")
      .select("id")
      .eq("id", integration.default_agent_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (data) return (data as { id: string }).id;
  }

  if (agentName && agentName.trim().length > 0) {
    const { data } = await admin
      .from("agents")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("name", escapeLike(agentName.trim()))
      .limit(1)
      .maybeSingle();
    if (data) return (data as { id: string }).id;
  }

  return null;
}

/**
 * Import a normalized external call into the `calls` table.
 *
 * Dedups on (workspace_id, external_source, external_call_id); resolves the
 * agent; persists the recording to Storage (never base64 in the DB); inserts
 * the call with analysis_status='pending'. Does NOT write import logs or trigger
 * analysis — the caller (route) owns those side effects.
 */
export async function importExternalCall(params: {
  admin: Admin;
  workspaceId: string;
  integration: CallProviderIntegration;
  normalized: NormalizedExternalCall;
}): Promise<ImportResult> {
  const { admin, workspaceId, integration, normalized } = params;
  const provider = normalized.provider;

  if (!normalized.external_call_id) {
    return { status: "error", message: "Missing external_call_id in payload" };
  }

  // ── Dedup ──────────────────────────────────────────────────────────────────
  const { data: existing } = await admin
    .from("calls")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("external_source", provider)
    .eq("external_call_id", normalized.external_call_id)
    .maybeSingle();
  if (existing) {
    return { status: "duplicate", callId: (existing as { id: string }).id };
  }

  // ── Agent mapping ──────────────────────────────────────────────────────────
  const agentId = await resolveAgentId(
    admin,
    workspaceId,
    integration,
    normalized.agent_name,
  );
  if (!agentId) {
    return {
      status: "error",
      message: normalized.agent_name
        ? `No agent matched "${normalized.agent_name}". Set a default agent on the integration.`
        : "No agent could be resolved. Set a default agent on the integration.",
    };
  }

  // ── Recording → Storage ────────────────────────────────────────────────────
  const { storagePath, recordingUrl } = await uploadImportedRecording({
    admin,
    workspaceId,
    externalCallId: normalized.external_call_id,
    recordingBase64: normalized.recording_base64,
    recordingUrl: normalized.recording_url,
  });

  // ── Insert call ────────────────────────────────────────────────────────────
  const direction = normalized.call_type === "inbound" ? "inbound" : "outbound";

  const { data: inserted, error: insErr } = await admin
    .from("calls")
    .insert({
      workspace_id: workspaceId,
      agent_id: agentId,
      direction,
      duration_seconds: normalized.duration_seconds ?? 0,
      status: "completed",
      recording_url: recordingUrl,
      recording_storage_path: storagePath,
      transcript: normalized.transcript ?? null,
      contact_name: normalized.contact_name ?? null,
      contact_phone: normalized.contact_phone ?? null,
      external_source: provider,
      external_call_id: normalized.external_call_id,
      external_agent_name: normalized.agent_name ?? null,
      department:
        normalized.department ?? integration.default_department ?? null,
      prospect_id: normalized.prospect_id ?? null,
      crm_id: normalized.crm_id ?? null,
      extension: normalized.extension ?? null,
      imported_payload: normalized.raw_payload ?? null,
      import_integration_id: integration.id,
      analysis_status: "pending",
      created_at: normalized.timestamp ?? new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    // Unique-index race: another concurrent import won — treat as duplicate.
    if ((insErr as { code?: string } | null)?.code === "23505") {
      const { data: dup } = await admin
        .from("calls")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("external_source", provider)
        .eq("external_call_id", normalized.external_call_id)
        .maybeSingle();
      if (dup)
        return { status: "duplicate", callId: (dup as { id: string }).id };
    }
    return {
      status: "error",
      message: insErr?.message ?? "Failed to insert call",
    };
  }

  return { status: "success", callId: (inserted as { id: string }).id };
}
