import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspace_id");
  if (!workspaceId)
    return NextResponse.json(
      { error: "workspace_id required" },
      { status: 400 },
    );

  // Check superadmin
  const { data: profile } = await supabase
    .from("users")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  const isSuperadmin =
    (profile as { is_superadmin: boolean } | null)?.is_superadmin ?? false;

  // Check owner
  const { data: ws } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .single();
  const isOwner = (ws as { owner_id: string } | null)?.owner_id === user.id;

  // Get member role
  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  const role: string = isOwner
    ? "owner"
    : ((member as { role: string } | null)?.role ?? "");

  return NextResponse.json({
    is_superadmin: isSuperadmin,
    is_owner: isOwner,
    role,
  });
}
