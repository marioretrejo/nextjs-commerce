import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

// ─── API key auth ─────────────────────────────────────────────────────────────
export async function authenticateApiKey(
  req: Request,
): Promise<{ workspaceId: string; userId: string } | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const rawKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!rawKey) return null;

  const hashed = crypto.createHash("sha256").update(rawKey).digest("hex");
  const admin = createAdminClient();
  const { data } = await admin
    .from("api_keys")
    .select("workspace_id, user_id, is_active")
    .eq("key_hash", hashed)
    .single();

  if (!data || !(data as { is_active: boolean }).is_active) return null;

  void Promise.resolve(
    admin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_hash", hashed),
  ).catch(() => null);

  return {
    workspaceId: (data as { workspace_id: string }).workspace_id,
    userId: (data as { user_id: string }).user_id,
  };
}
