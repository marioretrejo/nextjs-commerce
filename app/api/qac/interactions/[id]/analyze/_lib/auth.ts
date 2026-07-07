import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Workspace resolver ───────────────────────────────────────────────────────

export async function resolveWorkspaceId(
  req: Request,
): Promise<{ workspaceId: string; userId: string | null } | null> {
  // Internal request path (webhooks, background jobs)
  const internalSecret = req.headers.get("x-internal-secret");
  const headerWsId = req.headers.get("x-workspace-id");

  if (internalSecret !== null && headerWsId) {
    const configuredSecret = process.env["INTERNAL_API_SECRET"];

    // Fail closed: if the secret is not configured or too short, deny all internal requests.
    // This prevents vacuous equality (empty === empty) and forces proper configuration.
    if (!configuredSecret || configuredSecret.trim().length < 16) {
      console.error(
        "[qac/analyze] INTERNAL_API_SECRET is not configured or too short — internal auth disabled",
      );
      return null;
    }

    // Reject empty/missing bearer tokens without leaking timing information
    if (!internalSecret || internalSecret.length === 0) {
      console.warn("[qac/analyze] Internal request with empty secret rejected");
      return null;
    }

    // Timing-safe comparison prevents secret enumeration via response-time analysis
    const { timingSafeEqual } = await import("node:crypto");
    const configBuf = Buffer.from(configuredSecret, "utf8");
    const providedBuf = Buffer.from(internalSecret, "utf8");

    // Length mismatch is fine to reveal (constant-time comparison is meaningless here)
    if (
      configBuf.length !== providedBuf.length ||
      !timingSafeEqual(configBuf, providedBuf)
    ) {
      console.warn("[qac/analyze] Invalid internal secret — access denied");
      return null;
    }

    return { workspaceId: headerWsId, userId: null };
  }

  // Authenticated user path
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const admin = createAdminClient();
    const { data } = await admin
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!data) return null;
    const ws = data as { id: string };
    return { workspaceId: ws.id, userId: user.id };
  } catch {
    return null;
  }
}
