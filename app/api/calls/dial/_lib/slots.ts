import type { createAdminClient } from "@/lib/supabase/admin";

export type Admin = ReturnType<typeof createAdminClient>;

// Release a previously-claimed concurrent-call slot. Best-effort — swallows
// errors so a failed release never masks the original failure that triggered it.
export function releaseSlot(admin: Admin, workspaceId: string) {
  return Promise.resolve(
    admin.rpc("release_call_slot", { p_workspace_id: workspaceId }),
  ).catch(() => null);
}
