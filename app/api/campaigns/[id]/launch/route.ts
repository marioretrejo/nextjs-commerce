import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  checkMinuteLimit,
  minuteLimitBlockedResponse,
} from "@/lib/checkMinuteLimit";
import type { Campaign } from "@/lib/supabase/types";
import { NextResponse } from "next/server";
import { notifyWorkspace } from "@/lib/notifications/activity";
import { writeAuditLog } from "@/lib/admin-audit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS on user client verifies campaign belongs to user's workspace
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();
  if (!campaign)
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const c = campaign as Campaign;

  // Bulletproof minute limit enforcement gate
  const limitCheck = await checkMinuteLimit(c.workspace_id);
  if (!limitCheck.allowed) {
    return NextResponse.json(minuteLimitBlockedResponse(limitCheck), {
      status: 402,
    });
  }

  // Get agent
  const { data: agentData } = await supabase
    .from("agents")
    .select("*")
    .eq("id", c.agent_id ?? "")
    .single();
  if (!agentData)
    return NextResponse.json({ error: "Agent not found" }, { status: 400 });

  // Get pending contacts
  const { data: contacts } = await supabase
    .from("campaign_contacts")
    .select("*")
    .eq("campaign_id", id)
    .eq("status", "pending")
    .limit(1000);

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ error: "No pending contacts" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Launch = mark the campaign active. The continuous dialer (operational
  // worker → /api/cron/campaign-dial) claims pending contacts race-free and
  // places calls via LiveKit SIP (BYOT trunk) / the workspace telephony
  // provider. No batch call-out is issued here.
  await admin.from("campaigns").update({ status: "active" }).eq("id", id);
  void notifyWorkspace({
    workspaceId: c.workspace_id,
    title: "Campaign launched",
    message: `Campaign "${c.name}" was launched with ${contacts.length} contacts.`,
    link: `/campaigns/${id}`,
  });
  void writeAuditLog({
    actorId: user.id,
    actorType: "user",
    action: "campaign.launch",
    targetType: "campaign",
    targetId: id,
    workspaceId: c.workspace_id,
    metadata: { campaign_name: c.name, contacts: contacts.length },
  });
  return NextResponse.json({ ok: true, contacts: contacts.length });
}
