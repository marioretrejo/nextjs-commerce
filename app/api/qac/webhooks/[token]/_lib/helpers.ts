import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, upsertCustomer } from "@/lib/qac-customer";

// ─── Background QA analysis ───────────────────────────────────────────────────

export async function runQAAnalysis(
  interactionId: string,
  workspaceId: string,
) {
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

export async function resolveDepartmentId(
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

// ─── Customer enrichment (runs after response via next/server `after`) ────────

export async function enrichCustomer(
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
