import { createAdminClient } from "@/lib/supabase/admin";

/** Escapes SQL LIKE special characters to prevent wildcard injection. */
export function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

export interface QacWorkspace {
  id: string;
  has_compliance_qa: boolean;
  owner_id: string;
}

/**
 * Resolves the QAC workspace for a user.
 * Checks ownership first; falls back to workspace_members with owner/admin role.
 * Use this in every QAC API route instead of a local owner_id-only lookup.
 */
export async function resolveQacWorkspace(
  userId: string,
): Promise<QacWorkspace | null> {
  const admin = createAdminClient();

  const { data: owned } = await admin
    .from("workspaces")
    .select("id, has_compliance_qa, owner_id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();

  if (owned) return owned as QacWorkspace;

  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();

  if (!member) return null;
  const workspaceId = (member as { workspace_id: string }).workspace_id;

  const { data: ws } = await admin
    .from("workspaces")
    .select("id, has_compliance_qa, owner_id")
    .eq("id", workspaceId)
    .single();

  return (ws as QacWorkspace) ?? null;
}
