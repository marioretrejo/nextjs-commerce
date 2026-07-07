/**
 * POST /api/import/calls/[integrationId]
 *
 * Universal call-import webhook receiver. A provider (Squaretalk, Voiso,
 * CommPeak), an n8n flow, or a custom webhook POSTs a completed call here and it
 * is imported into the SAME `calls` table used by /calls and /quality.
 *
 * Auth:  header `x-voiceop-import-secret` must match the integration's
 *        webhook_secret (timing-safe). No secret configured → 401.
 *
 * Flow:  normalize → dedup → map agent → store recording → insert call →
 *        write import log → trigger background analysis → respond fast.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import type { CallProviderIntegration } from "@/lib/supabase/types";
import { normalizeExternalCall } from "@/lib/call-import/normalize";
import { importExternalCall } from "@/lib/call-import/import";
import { triggerCallAnalysis } from "@/lib/call-import/analyze-trigger";

export const dynamic = "force-dynamic";

function secretMatches(provided: string | null, expected: string | null) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const { integrationId } = await params;
  const admin = createAdminClient();

  // ── Resolve integration ────────────────────────────────────────────────────
  const { data: integData } = await admin
    .from("call_provider_integrations")
    .select("*")
    .eq("id", integrationId)
    .maybeSingle();
  const integration = integData as CallProviderIntegration | null;

  if (!integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 },
    );
  }
  if (integration.status !== "active") {
    return NextResponse.json(
      { error: "Integration is not active" },
      { status: 403 },
    );
  }

  // ── Secret check ────────────────────────────────────────────────────────────
  const provided = req.headers.get("x-voiceop-import-secret");
  if (!secretMatches(provided, integration.webhook_secret)) {
    return NextResponse.json(
      { error: "Invalid import secret" },
      { status: 401 },
    );
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const normalized = normalizeExternalCall(integration.provider, payload);

  // Helper to record an import-log row (best-effort) + refresh integration state.
  async function log(
    status: "success" | "error" | "duplicate",
    message: string | null,
    callId: string | null,
  ) {
    await admin.from("call_import_logs").insert({
      workspace_id: integration!.workspace_id,
      integration_id: integration!.id,
      provider: integration!.provider,
      external_call_id: normalized.external_call_id || null,
      status,
      message,
      payload: (payload ?? null) as Record<string, unknown> | null,
      response: null,
      call_id: callId,
    });
    await admin
      .from("call_provider_integrations")
      .update({
        last_event_at: new Date().toISOString(),
        last_error: status === "error" ? message : null,
        ...(status === "error" ? { status: "error" as const } : {}),
      })
      .eq("id", integration!.id);
  }

  // ── Validate external id ────────────────────────────────────────────────────
  if (!normalized.external_call_id) {
    await log("error", "Missing external call id in payload", null);
    return NextResponse.json(
      { ok: false, error: "Missing external call id in payload" },
      { status: 400 },
    );
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  const result = await importExternalCall({
    admin,
    workspaceId: integration.workspace_id,
    integration,
    normalized,
  });

  if (result.status === "duplicate") {
    await log("duplicate", "Duplicate event ignored", result.callId);
    return NextResponse.json({
      ok: true,
      duplicate: true,
      call_id: result.callId,
    });
  }

  if (result.status === "error") {
    await log("error", result.message, null);
    return NextResponse.json(
      { ok: false, error: result.message },
      { status: 422 },
    );
  }

  // Success — log, trigger background analysis, respond fast.
  await log("success", null, result.callId);
  triggerCallAnalysis(result.callId);

  return NextResponse.json({
    ok: true,
    duplicate: false,
    call_id: result.callId,
    analysis_status: "pending",
  });
}
