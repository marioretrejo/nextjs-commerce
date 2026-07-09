import { processQacBacklog, processQacInteraction } from "@/lib/qac/pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserWorkspaces } from "@/lib/workspace";
import { after, NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await getUserWorkspaces();
  const workspaceIds = workspaces.map((workspace) => workspace.id);
  if (workspaceIds.length === 0) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: interaction } = await admin
    .from("qac_interactions")
    .select("id, workspace_id")
    .eq("id", id)
    .in("workspace_id", workspaceIds)
    .maybeSingle();

  if (!interaction) {
    return NextResponse.json(
      { error: "Interaction not found" },
      { status: 404 },
    );
  }

  await admin.from("qac_ingestion_logs").insert({
    workspace_id: (interaction as { workspace_id: string }).workspace_id,
    external_call_id: id,
    status: "manual_analysis_requested",
    raw_payload: {},
  });

  after(async () => {
    await processQacInteraction(id);
    await processQacBacklog({
      workspaceId: (interaction as { workspace_id: string }).workspace_id,
      limit: 3,
    });
  });

  return NextResponse.json({ ok: true, queued: true });
}
