/**
 * PATCH /api/admin/workspaces/[id]/branding
 * Sets or clears white-label branding for a workspace. Superadmin only.
 * Body: { app_name?, logo_url?, primary_color?, favicon_url?, custom_css? } | null to clear
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/admin-audit";
import { NextResponse } from "next/server";

async function requireSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  const { data: p } = await supabase
    .from("users")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!(p as { is_superadmin: boolean } | null)?.is_superadmin) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user, error: null };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const { user, error } = await requireSuperadmin();
  if (!user || error)
    return (
      error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

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

  const admin = createAdminClient();

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
