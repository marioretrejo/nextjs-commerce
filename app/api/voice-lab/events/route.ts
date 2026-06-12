/**
 * GET /api/voice-lab/events?room=<roomName>
 *
 * Returns recent call_events for a Voice Lab session room.
 * Auth-gated: user must be authenticated and the room must belong to their workspace.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const room = url.searchParams.get("room");
  if (!room) {
    return NextResponse.json({ error: "room param required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Resolve the user's workspace to scope the query
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!ws) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const { data: events, error } = await admin
    .from("call_events")
    .select("id, event_type, payload, created_at, call_id")
    .eq("call_room", room)
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: `Failed to load events: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ events: events ?? [] });
}
