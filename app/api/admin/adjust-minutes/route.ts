import { requireSuperadmin } from "@/lib/admin/guard";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return gate.response;
  const { admin, user } = gate;

  const body = (await req.json()) as {
    workspace_id: string;
    minutes_used?: number;
    minutes_limit?: number;
    bonus_minutes?: number;
    reason: string;
  };

  if (!body.workspace_id || !body.reason) {
    return NextResponse.json(
      { error: "workspace_id and reason are required" },
      { status: 400 },
    );
  }

  // Fetch current values
  const { data: ws } = await admin
    .from("workspaces")
    .select("minutes_used, minutes_limit")
    .eq("id", body.workspace_id)
    .single();

  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const current = ws as { minutes_used: number; minutes_limit: number };
  const newUsed =
    body.minutes_used !== undefined
      ? body.minutes_used
      : body.bonus_minutes !== undefined
        ? Number(current.minutes_used) - body.bonus_minutes
        : undefined;
  const newLimit =
    body.minutes_limit !== undefined ? body.minutes_limit : undefined;

  const patch: Record<string, unknown> = {};
  if (newUsed !== undefined) patch["minutes_used"] = Math.max(0, newUsed);
  if (newLimit !== undefined) patch["minutes_limit"] = newLimit;
  if (
    newUsed !== undefined &&
    Number(newUsed) < (newLimit ?? current.minutes_limit)
  ) {
    patch["overage_blocked"] = false;
  }

  if (Object.keys(patch).length > 0) {
    await admin.from("workspaces").update(patch).eq("id", body.workspace_id);
  }

  // Log in workspace_events
  await admin.from("workspace_events").insert({
    workspace_id: body.workspace_id,
    event_type: "minutes_adjusted",
    details: {
      adjusted_by: user.id,
      reason: body.reason,
      previous_used: current.minutes_used,
      previous_limit: current.minutes_limit,
      new_used: patch["minutes_used"] ?? current.minutes_used,
      new_limit: patch["minutes_limit"] ?? current.minutes_limit,
    },
  });

  return NextResponse.json({ ok: true });
}
