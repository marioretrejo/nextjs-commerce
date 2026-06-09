import { createAdminClient } from "@/lib/supabase/admin";

type ActivityType = "activity" | "broadcast" | "team_invite";

interface ActivityOptions {
  workspaceId: string;
  type?: ActivityType;
  title: string;
  message: string;
  link?: string;
  actorName?: string;
}

/**
 * Insert a notification for every member of a workspace.
 * Fire-and-forget — never throws.
 */
export async function notifyWorkspace(opts: ActivityOptions): Promise<void> {
  try {
    const admin = createAdminClient();
    const {
      workspaceId,
      type = "activity",
      title,
      message,
      link,
      actorName,
    } = opts;

    const { data: members } = await admin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId);

    const userIds = (members ?? [])
      .map((m) => (m as { user_id: string | null }).user_id)
      .filter(Boolean) as string[];

    if (!userIds.length) return;

    const rows = userIds.map((uid) => ({
      workspace_id: workspaceId,
      user_id: uid,
      type,
      title,
      message,
      link: link ?? null,
      actor_name: actorName ?? null,
    }));

    await admin.from("notifications").insert(rows);
  } catch {
    // never block the caller
  }
}
