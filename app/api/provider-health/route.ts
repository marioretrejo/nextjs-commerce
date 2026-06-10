/**
 * GET /api/provider-health
 *
 * Returns provider health summary for the authenticated user's workspace.
 * Superadmins receive global platform health (workspace_id = null rows).
 *
 * Auth: session cookie required.
 * Query params:
 *   window_minutes  — 5 | 15 | 60 | 1440  (default 15)
 *   workspace_id    — override (admin only)
 *   provider        — filter to one provider name
 *   provider_type   — filter to one provider type
 *
 * Never exposes secrets, API keys, or raw error messages.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getProviderHealthSummary,
  getJobsHealth,
  getWebhookHealthFromEvents,
  getProviderHealthTimeline,
} from "@/lib/observability/provider-health";

export const dynamic = "force-dynamic";

const ALLOWED_WINDOWS = new Set([5, 15, 60, 1440]);

export async function GET(req: Request) {
  // ── Auth ───────────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Determine if user is superadmin
  const { data: profile } = await admin
    .from("users")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  const isSuperadmin = !!profile?.is_superadmin;

  // Resolve workspace_id
  const url = new URL(req.url);
  const rawWorkspaceId = url.searchParams.get("workspace_id");

  let workspaceId: string | null = null;

  if (rawWorkspaceId) {
    // Only admins can override workspace
    if (!isSuperadmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    workspaceId = rawWorkspaceId;
  } else if (!isSuperadmin) {
    // Regular users: find their workspace via membership or ownership
    const { data: ws } = await admin
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!ws) {
      // Try workspace_members
      const { data: member } = await admin
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      workspaceId = member?.workspace_id ?? null;
    } else {
      workspaceId = ws.id;
    }
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }
  }
  // isSuperadmin with no workspace_id override → workspaceId remains null (global)

  // ── Query params ───────────────────────────────────────────────────────────────
  const windowParam = parseInt(
    url.searchParams.get("window_minutes") ?? "15",
    10,
  );
  const windowMinutes = ALLOWED_WINDOWS.has(windowParam) ? windowParam : 15;
  const providerFilter = url.searchParams.get("provider");
  const typeFilter = url.searchParams.get("provider_type");

  // ── Fetch health data ──────────────────────────────────────────────────────────
  const [summaryResult, jobsHealth, webhookHealth, timeline] =
    await Promise.all([
      getProviderHealthSummary({ supabase: admin, windowMinutes, workspaceId }),
      getJobsHealth(admin, workspaceId),
      getWebhookHealthFromEvents(admin, windowMinutes, workspaceId),
      getProviderHealthTimeline(admin, windowMinutes, workspaceId, 20),
    ]);

  let summary = summaryResult.rows;

  // Apply optional filters
  if (providerFilter) {
    summary = summary.filter((r) => r.provider === providerFilter);
  }
  if (typeFilter) {
    summary = summary.filter((r) => r.provider_type === typeFilter);
  }

  // ── Compute incidents from summary ─────────────────────────────────────────────
  const incidents = summary
    .filter((r) => r.status === "down" || r.status === "degraded")
    .map((r) => ({
      provider: r.provider,
      status: r.status,
      circuit_state: r.circuit_state,
      since: r.checked_at,
      last_error_code: r.last_error_code,
    }));

  return NextResponse.json({
    window_minutes: windowMinutes,
    workspace_id: workspaceId,
    is_global: workspaceId === null,
    generated_at: new Date().toISOString(),
    summary,
    incidents,
    jobs: jobsHealth,
    webhooks: webhookHealth,
    timeline,
  });
}
