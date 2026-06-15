import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

function verifyCronSecret(req: Request): boolean {
  const secret =
    process.env["CRON_SECRET"] ?? process.env["INTERNAL_API_SECRET"];
  if (!secret || secret.trim().length < 16) return false;
  const authHeader = req.headers.get("Authorization");
  const provided = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  if (!provided) return false;
  const a = Buffer.from(secret, "utf8");
  const b = Buffer.from(provided.trim(), "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Called by Vercel Cron on the 1st of each month (see vercel.json)
// Resets workspace minutes — replaces the commented pg_cron in migration 015
export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // 1. Fetch workspaces to reset before modifying them (capture previous minutes_used)
  const { data: workspaces, error: fetchErr } = await admin
    .from("workspaces")
    .select("id, owner_id, minutes_used, minutes_limit")
    .gt("minutes_limit", 0);

  if (fetchErr) {
    console.error("Minute reset — workspace fetch failed:", fetchErr);
    return NextResponse.json(
      { ok: false, error: fetchErr.message },
      { status: 500 },
    );
  }

  const workspaceList = (workspaces ?? []) as {
    id: string;
    owner_id: string;
    minutes_used: number;
    minutes_limit: number;
  }[];

  if (workspaceList.length === 0) {
    return NextResponse.json({ ok: true, reset_at: now, workspaces_reset: 0, campaigns_reactivated: 0 });
  }

  const workspaceIds = workspaceList.map((w) => w.id);

  // 2. Reset all workspaces (same logic as before)
  const { error: resetErr } = await admin
    .from("workspaces")
    .update({
      minutes_used: 0,
      overage_blocked: false,
      minutes_reset_at: now,
    })
    .gt("minutes_limit", 0);

  if (resetErr) {
    console.error("Minute reset failed:", resetErr);
    return NextResponse.json(
      { ok: false, error: resetErr.message },
      { status: 500 },
    );
  }

  // 3. Re-activate campaigns paused specifically by the minute limit
  const { data: reactivated, error: campaignErr } = await admin
    .from("campaigns")
    .update({ status: "active", pause_reason: null })
    .in("workspace_id", workspaceIds)
    .eq("pause_reason", "minute_limit_reached")
    .select("id");

  if (campaignErr) {
    console.error("Minute reset — campaign reactivation failed:", campaignErr);
    // Non-fatal: log and continue
  }

  const campaignsReactivated = reactivated?.length ?? 0;

  // 4. Insert workspace_events audit records
  if (workspaceList.length > 0) {
    const events = workspaceList.map((w) => ({
      workspace_id: w.id,
      event_type: "minutes_reset" as const,
      details: {
        reset_at: now,
        previous_minutes_used: w.minutes_used,
        minutes_limit: w.minutes_limit,
      },
    }));

    const { error: eventsErr } = await admin
      .from("workspace_events")
      .insert(events);

    if (eventsErr) {
      console.error("Minute reset — workspace_events insert failed:", eventsErr);
      // Non-fatal: log and continue
    }
  }

  // 5. Insert in-app notifications for each workspace owner
  if (workspaceList.length > 0) {
    const notifications = workspaceList.map((w) => ({
      user_id: w.owner_id,
      type: "minutes_reset",
      title: "Your minutes have reset",
      body: `You have ${w.minutes_limit} minutes available this month.`,
      read: false,
    }));

    const { error: notifErr } = await admin
      .from("notifications")
      .insert(notifications);

    if (notifErr) {
      console.error("Minute reset — notifications insert failed:", notifErr);
      // Non-fatal: log and continue
    }
  }

  return NextResponse.json({
    ok: true,
    reset_at: now,
    workspaces_reset: workspaceList.length,
    campaigns_reactivated: campaignsReactivated,
  });
}
