import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { resolveQacWorkspace as resolveWorkspace } from "@/lib/qac-workspace";

export async function PUT(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ws = await resolveWorkspace(user.id);
  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const body = (await req.json()) as { items: { id: string; sort_order: number }[] };

  if (!Array.isArray(body.items) || body.items.length === 0)
    return NextResponse.json({ error: "items array required" }, { status: 400 });

  const admin = createAdminClient();

  // Verify all rules belong to this workspace before updating
  const ids = body.items.map((i) => i.id);
  const { data: existing } = await admin
    .from("qac_rules")
    .select("id")
    .eq("workspace_id", ws.id)
    .in("id", ids);

  const validIds = new Set((existing ?? []).map((r) => (r as { id: string }).id));

  // Update each valid rule's sort_order
  const updates = body.items.filter((item) => validIds.has(item.id));

  await Promise.all(
    updates.map(({ id, sort_order }) =>
      admin
        .from("qac_rules")
        .update({ sort_order })
        .eq("id", id)
        .eq("workspace_id", ws.id),
    ),
  );

  return NextResponse.json({ ok: true, updated: updates.length });
}
