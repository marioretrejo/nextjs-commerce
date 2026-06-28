import { createAdminClient } from "@/lib/supabase/admin";

export async function updateWorkspaceMinutes(
  workspace_id: string,
  duration_seconds: number,
): Promise<void> {
  const admin = createAdminClient();
  const duration_minutes = duration_seconds / 60.0;

  // Atomic increment via RPC — a single SQL UPDATE that also flips
  // overage_blocked when the limit is crossed. This avoids the read-modify-write
  // race where two concurrent call-ended webhooks for the same workspace both
  // read a stale minutes_used and the last write wins (undercounting usage).
  const { data: result, error } = await admin.rpc(
    "increment_workspace_minutes",
    {
      p_workspace_id: workspace_id,
      p_minutes: duration_minutes,
    },
  );
  if (error) {
    console.error("updateWorkspaceMinutes: increment failed", error.message);
    return;
  }

  const row = (
    result as
      | {
          prev_minutes_used: number;
          new_minutes_used: number;
          minutes_limit: number;
          owner_id: string;
        }[]
      | null
  )?.[0];
  if (!row) return;

  // Re-read plan for notification context (not on the hot atomic path).
  const { data: ws } = await admin
    .from("workspaces")
    .select("plan")
    .eq("id", workspace_id)
    .single();

  const prevUsed = Number(row.prev_minutes_used ?? 0);
  const newUsed = Number(row.new_minutes_used ?? 0);
  const limit = Number(row.minutes_limit ?? 0);
  const ownerId = row.owner_id;
  const prevPct = limit > 0 ? (prevUsed / limit) * 100 : 0;
  const newPct = limit > 0 ? (newUsed / limit) * 100 : 0;

  // Threshold notifications
  const crossed80 = prevPct < 80 && newPct >= 80;
  const crossed90 = prevPct < 90 && newPct >= 90;
  const crossed100 = prevPct < 100 && newPct >= 100;

  if (crossed100) {
    await Promise.all([
      admin.from("notifications").insert({
        user_id: ownerId,
        type: "minutes_100",
        title: "Minute limit reached",
        body: `You've used all ${limit} minutes on your plan. All outbound calls have been paused.`,
        read: false,
      }),
      admin.from("workspace_events").insert({
        workspace_id,
        event_type: "limit_reached",
        details: {
          minutes_used: newUsed,
          minutes_limit: limit,
          plan: ws?.plan ?? null,
        },
      }),
      // Pause all active campaigns
      admin
        .from("campaigns")
        .update({ status: "paused", pause_reason: "minute_limit_reached" })
        .eq("workspace_id", workspace_id)
        .eq("status", "active"),
    ]);
  } else if (crossed90) {
    await admin.from("notifications").insert({
      user_id: ownerId,
      type: "minutes_90",
      title: "90% of minutes used",
      body: `Only ${Math.max(0, limit - newUsed).toFixed(0)} minutes remaining. Your calls will stop at ${limit} minutes.`,
      read: false,
    });
  } else if (crossed80) {
    await admin.from("notifications").insert({
      user_id: ownerId,
      type: "minutes_80",
      title: "80% of minutes used",
      body: `You've used ${newUsed.toFixed(0)} of your ${limit} minutes. ${Math.max(0, limit - newUsed).toFixed(0)} minutes remaining.`,
      read: false,
    });
  }
}
