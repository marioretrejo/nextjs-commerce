/**
 * GET /api/calls/dial/status?room={roomName}
 *
 * Lightweight status check for the OutboundDialer polling loop.
 * Returns the current status of a call by its LiveKit room name.
 * Session-auth — no workspace_id param needed.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const room = searchParams.get("room") ?? "";
  if (!room)
    return NextResponse.json({ error: "room required" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const { data: call } = await admin
    .from("calls")
    .select("status, duration_seconds")
    .eq("workspace_id", (ws as { id: string }).id)
    .eq("retell_call_id", room)
    .maybeSingle();

  // Call record not yet written (very fresh call) → still dialing
  if (!call) return NextResponse.json({ status: "dialing" });

  return NextResponse.json({
    status: (call as { status: string }).status,
    duration_seconds:
      (call as { duration_seconds: number }).duration_seconds ?? 0,
  });
}
