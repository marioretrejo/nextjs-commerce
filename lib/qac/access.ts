import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserWorkspaces } from "@/lib/workspace";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export interface QacAccess {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  isAdmin: boolean;
  isSuperadmin: boolean;
}

async function resolveQacAccess(): Promise<{
  access: QacAccess | null;
  redirectTo: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { access: null, redirectTo: "/login?callbackUrl=/qa-center" };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, is_superadmin")
    .eq("id", user.id)
    .single();
  const isSuperadmin = Boolean(
    (profile as { is_superadmin?: boolean } | null)?.is_superadmin,
  );

  const hdrs = await headers();
  const impersonatingWorkspaceId = hdrs.get("x-impersonation-workspace-id");

  let workspace: {
    id: string;
    name?: string | null;
    owner_id?: string | null;
    has_compliance_qa?: boolean | null;
  } | null = null;

  if (isSuperadmin && impersonatingWorkspaceId) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("workspaces")
      .select("id, name, owner_id, has_compliance_qa")
      .eq("id", impersonatingWorkspaceId)
      .single();
    workspace = data;
  } else {
    workspace = (await getUserWorkspaces())[0] ?? null;
  }

  if (!workspace) return { access: null, redirectTo: "/dashboard" };
  if (!isSuperadmin && !workspace.has_compliance_qa) {
    return { access: null, redirectTo: "/dashboard" };
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const role = (member as { role?: string } | null)?.role ?? null;
  const isOwner = workspace.owner_id === user.id;
  const isAdmin =
    isSuperadmin ||
    isOwner ||
    role === "owner" ||
    role === "admin" ||
    role === "supervisor";

  return {
    redirectTo: "/qa-center",
    access: {
      userId: user.id,
      workspaceId: workspace.id,
      workspaceName: workspace.name ?? "Workspace",
      isAdmin,
      isSuperadmin,
    },
  };
}

export async function getQacAccess(): Promise<QacAccess | null> {
  return (await resolveQacAccess()).access;
}

export async function requireQacAccess(adminOnly = false): Promise<QacAccess> {
  const { access, redirectTo } = await resolveQacAccess();
  if (!access) redirect(redirectTo);
  if (adminOnly && !access.isAdmin) redirect("/qa-center");
  return access;
}
