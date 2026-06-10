/**
 * GET  /api/alerts  — List alert incidents
 * PATCH /api/alerts — Acknowledge or resolve an incident
 *
 * Auth: Session cookie (workspace member) OR Bearer vos_xxx API key.
 * The x-api-workspace-id header is injected by middleware for API-key requests.
 *
 * GET query params:
 *   status      — open | acknowledged | resolved | muted  (default: open,acknowledged)
 *   severity    — info | warning | critical
 *   signal      — any valid AlertSignal
 *   workspace_id — explicit filter (superadmin only; regular users see their workspace)
 *   limit       — 1–200 (default 50)
 *
 * PATCH body: { id: string, action: "acknowledge" | "resolve" }
 *
 * Response:
 *   GET:  { incidents: AlertIncidentRow[], counts: { open, acknowledged, critical, warning } }
 *   PATCH: { ok: true, incident_id: string, action: string }
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getOpenIncidents,
  acknowledgeIncident,
  resolveIncident,
  type AlertIncidentStatus,
  type AlertSeverity,
  type AlertSignal,
} from "@/lib/observability/alerting";

async function createSupabaseClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const supabaseAnonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!;
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(
              name,
              value,
              options as Parameters<typeof cookieStore.set>[2],
            ),
          );
        } catch {
          // Server component — ignore set errors
        }
      },
    },
  });
}

export async function GET(req: Request) {
  const supabase = await createSupabaseClient();

  // Resolve authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Also check API-key workspace header (set by middleware for Bearer vos_xxx)
  const apiWorkspaceId = req.headers.get("x-api-workspace-id");

  if (!user && !apiWorkspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Determine workspace scope
  let workspaceId: string | null | undefined;

  if (apiWorkspaceId) {
    workspaceId = apiWorkspaceId;
  } else if (user) {
    // Check superadmin — they can query all or a specific workspace
    const { data: profile } = await supabase
      .from("users")
      .select("is_superadmin")
      .eq("id", user.id)
      .single();

    const isSuperadmin = profile?.is_superadmin === true;

    const url = new URL(req.url);
    const wsParam = url.searchParams.get("workspace_id");

    if (isSuperadmin) {
      // Superadmin: use requested workspace or global (null)
      workspaceId = wsParam ?? undefined;
    } else {
      // Regular user: resolve their active workspace
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      workspaceId =
        membership?.workspace_id ??
        (await supabase
          .from("workspaces")
          .select("id")
          .eq("owner_id", user.id)
          .limit(1)
          .maybeSingle()
          .then((r) => r.data?.id ?? null));
    }
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const severityParam = url.searchParams.get(
    "severity",
  ) as AlertSeverity | null;
  const signalParam = url.searchParams.get("signal") as AlertSignal | null;
  const limitParam = Math.min(
    200,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)),
  );

  let statusFilter: AlertIncidentStatus | AlertIncidentStatus[] | undefined;
  if (statusParam) {
    if (statusParam === "all") {
      statusFilter = ["open", "acknowledged", "resolved", "muted"];
    } else {
      statusFilter = statusParam as AlertIncidentStatus;
    }
  }

  const incidents = await getOpenIncidents(supabase, {
    workspaceId,
    status: statusFilter,
    severity: severityParam ?? undefined,
    signal: signalParam ?? undefined,
    limit: limitParam,
  });

  const counts = {
    open: incidents.filter((i) => i.status === "open").length,
    acknowledged: incidents.filter((i) => i.status === "acknowledged").length,
    critical: incidents.filter((i) => i.severity === "critical").length,
    warning: incidents.filter((i) => i.severity === "warning").length,
  };

  return NextResponse.json({ incidents, counts });
}

export async function PATCH(req: Request) {
  const supabase = await createSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const apiWorkspaceId = req.headers.get("x-api-workspace-id");

  if (!user && !apiWorkspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; action?: string };
  try {
    body = (await req.json()) as { id?: string; action?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, action } = body;
  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { error: "Missing required field: id" },
      { status: 400 },
    );
  }
  if (action !== "acknowledge" && action !== "resolve") {
    return NextResponse.json(
      { error: "action must be 'acknowledge' or 'resolve'" },
      { status: 400 },
    );
  }

  let result: { error: string | null };
  if (action === "acknowledge") {
    result = await acknowledgeIncident(supabase, id);
  } else {
    result = await resolveIncident(supabase, id);
  }

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, incident_id: id, action });
}
