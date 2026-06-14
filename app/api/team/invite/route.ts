import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendTeamInvite } from "@/lib/email";
import crypto from "crypto";
import { z } from "zod";
import { apiError, apiOk, parseBody } from "@/lib/api";
import { notifyWorkspace } from "@/lib/notifications/activity";
import { writeAuditLog } from "@/lib/admin-audit";

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]).default("editor"),
  workspace_id: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const parsed = parseBody(InviteSchema, await req.json());
  if (!parsed.success) return parsed.response;
  const { email, role, workspace_id } = parsed.data;

  // Get the workspace to invite to (default to user's first workspace)
  let wsId = workspace_id;
  if (!wsId) {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .single();
    wsId = (ws as { id: string } | null)?.id;
  }

  if (!wsId) return apiError("Workspace not found", 404);

  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, name, owner_id")
    .eq("id", wsId)
    .single();
  if (!ws) return apiError("Workspace not found", 404);

  const workspace = ws as { id: string; name: string; owner_id: string };
  const admin = createAdminClient();

  // Fix B: Only workspace owner or active admin can invite
  const isOwner = workspace.owner_id === user.id;
  if (!isOwner) {
    const { data: callerMember } = await admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", wsId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    const isAdmin = (callerMember as { role: string } | null)?.role === "admin";
    if (!isAdmin) return apiError("Forbidden", 403);
  }

  // Check if user already exists
  const { data: existingUser } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  const inviteeId = (existingUser as { id: string } | null)?.id ?? null;
  const inviteToken = crypto.randomUUID();

  let memberData: Record<string, unknown>;

  if (inviteeId) {
    // Known user: upsert on (workspace_id, user_id) — no invite_token needed
    const { data, error } = await admin
      .from("workspace_members")
      .upsert(
        {
          workspace_id: wsId,
          user_id: inviteeId,
          role: role ?? "editor",
          status: "active",
        },
        { onConflict: "workspace_id,user_id" },
      )
      .select()
      .single();
    if (error) {
      console.error("[team/invite] upsert error:", error);
      return apiError("Internal server error", 500);
    }
    memberData = data as Record<string, unknown>;
  } else {
    // Fix C: Check for existing pending invite by email to avoid duplicates
    const { data: existingInvite } = await admin
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", wsId)
      .eq("invite_email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      // Fix D: Re-invite — refresh token, role, and timestamp
      const { data, error } = await admin
        .from("workspace_members")
        .update({
          invite_token: inviteToken,
          role: role ?? "editor",
          invited_at: new Date().toISOString(),
        })
        .eq("id", (existingInvite as { id: string }).id)
        .select()
        .single();
      if (error) {
        console.error("[team/invite] update error:", error);
        return apiError("Internal server error", 500);
      }
      memberData = data as Record<string, unknown>;
    } else {
      // Fix D: New invite — plain INSERT (no upsert, user_id is null)
      const { data, error } = await admin
        .from("workspace_members")
        .insert({
          workspace_id: wsId,
          user_id: null,
          role: role ?? "editor",
          status: "pending",
          invite_email: email,
          invite_token: inviteToken,
        })
        .select()
        .single();
      if (error) {
        console.error("[team/invite] insert error:", error);
        return apiError("Internal server error", 500);
      }
      memberData = data as Record<string, unknown>;
    }
  }

  // Send invite email for pending (non-existing) members
  const inviterName =
    (user.user_metadata?.["full_name"] as string | undefined) ??
    user.email ??
    "A teammate";
  if (!inviteeId) {
    const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://voiceos.app";
    sendTeamInvite({
      to: email,
      inviterName,
      workspaceName: workspace.name,
      inviteToken,
      appUrl,
    }).catch(console.error);
  }

  void notifyWorkspace({
    workspaceId: wsId,
    type: "team_invite",
    title: "Team member invited",
    message: `${inviterName} invited ${email} to the workspace as ${role}.`,
    link: "/team",
    actorName: inviterName,
  });
  void writeAuditLog({
    actorId: user.id,
    actorType: "user",
    action: "team.invite",
    targetType: "user",
    workspaceId: wsId,
    metadata: { invited_email: email, role, workspace_name: workspace.name },
  });

  return apiOk(memberData, 201);
}
