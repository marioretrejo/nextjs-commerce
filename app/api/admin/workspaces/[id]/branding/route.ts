/**
 * PATCH /api/admin/workspaces/[id]/branding
 * Sets or clears white-label branding for a workspace. Superadmin only.
 * Body: { app_name?, logo_url?, primary_color?, favicon_url?, custom_css? } | null to clear
 */
import { requireSuperadmin } from "@/lib/admin/guard";
import { writeAuditLog } from "@/lib/admin-audit";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const gate = await requireSuperadmin();
  if (!gate.ok) return gate.response;
  const { admin, user } = gate;

  let body: {
    app_name?: string;
    logo_url?: string | null;
    primary_color?: string;
    favicon_url?: string | null;
    custom_css?: string | null;
  } | null;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // null body = clear branding entirely
  const branding =
    body === null
      ? null
      : {
          app_name: body.app_name?.trim() || "VoiceOS",
          logo_url: body.logo_url ?? null,
          primary_color: body.primary_color?.trim() || "#0a0a0a",
          favicon_url: body.favicon_url ?? null,
          custom_css: body.custom_css ?? null,
        };

  const { error: dbErr } = await admin
    .from("workspaces")
    .update({ branding })
    .eq("id", workspaceId);

  if (dbErr)
    return NextResponse.json({ error: dbErr.message }, { status: 500 });

  const ip =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    undefined;
  await writeAuditLog({
    actorId: user.id,
    actorType: "superadmin",
    action: branding
      ? "workspace.branding_updated"
      : "workspace.branding_cleared",
    targetType: "workspace",
    targetId: workspaceId,
    workspaceId,
    metadata: { branding },
    ip,
  });

  return NextResponse.json({ ok: true, branding });
}
