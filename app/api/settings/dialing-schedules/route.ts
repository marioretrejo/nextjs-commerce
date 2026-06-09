/**
 * GET  /api/settings/dialing-schedules  — list workspace schedules
 * POST /api/settings/dialing-schedules  — create a schedule
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type { DialingSchedule } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ws } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!ws) return NextResponse.json({ schedules: [] });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dialing_schedules")
    .select("*")
    .eq("workspace_id", (ws as { id: string }).id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedules: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Partial<DialingSchedule>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name?.trim())
    return NextResponse.json({ error: '"name" is required' }, { status: 400 });
  if (!body.timezone?.trim())
    return NextResponse.json(
      { error: '"timezone" is required' },
      { status: 400 },
    );
  if (!Array.isArray(body.windows))
    return NextResponse.json(
      { error: '"windows" must be an array' },
      { status: 400 },
    );

  const { data: ws } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const admin = createAdminClient();

  // Ensure at most one default per workspace
  if (body.is_default) {
    await admin
      .from("dialing_schedules")
      .update({ is_default: false })
      .eq("workspace_id", (ws as { id: string }).id)
      .eq("is_default", true);
  }

  const { data, error } = await admin
    .from("dialing_schedules")
    .insert({
      workspace_id: (ws as { id: string }).id,
      agent_id: body.agent_id ?? null,
      name: body.name.trim(),
      timezone: body.timezone.trim(),
      windows: body.windows,
      is_default: body.is_default ?? false,
    })
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule: data }, { status: 201 });
}
