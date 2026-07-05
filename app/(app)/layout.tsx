import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { RouteGuard } from "@/components/layout/route-guard";
import { CommandPalette } from "@/components/command-palette";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { MinuteAlerts } from "@/components/minute-usage/minute-alerts";
import { AnalyticsCopilot } from "@/components/copilot/AnalyticsCopilot";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { ActivationBanner } from "@/components/billing/ActivationBanner";
import { EnterpriseQuotaBar } from "@/components/billing/EnterpriseQuotaBar";
import type { User, WorkspaceBranding } from "@/lib/supabase/types";
import {
  getAccountState,
  accountStateNeedsBanner,
  type AccountStateInput,
} from "@/lib/account-state";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserWorkspaces } from "@/lib/workspace";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login?callbackUrl=/dashboard");

  // ── Impersonation: superadmin viewing a client workspace ──────────────────
  const hdrs = await headers();
  const impersonatingWorkspaceId = hdrs.get("x-impersonation-workspace-id");

  const [{ data: rawProfile }, notifications] = await Promise.all([
    supabase.from("users").select("*").eq("id", authUser.id).single(),
    supabase
      .from("notifications")
      .select("id", { count: "exact" })
      .eq("user_id", authUser.id)
      .eq("read", false),
  ]);

  const userProfile = rawProfile as User | null;
  if (!userProfile) redirect("/login?callbackUrl=/dashboard");
  if (userProfile.is_suspended) redirect("/suspended");

  let workspaces: Awaited<ReturnType<typeof getUserWorkspaces>>;
  let isImpersonating = false;

  if (impersonatingWorkspaceId && userProfile.is_superadmin) {
    // Admin is impersonating a workspace — fetch the target via admin client
    const admin = createAdminClient();
    const { data: impWs } = await admin
      .from("workspaces")
      .select("*")
      .eq("id", impersonatingWorkspaceId)
      .single();
    workspaces = impWs ? [impWs as (typeof workspaces)[0]] : [];
    isImpersonating = true;
  } else {
    workspaces = await getUserWorkspaces();
  }

  const workspace = workspaces[0];
  if (!workspace) redirect("/onboarding");

  // ── Workspace-level suspension (legacy is_suspended OR billing_status) ──────
  const ws = workspace as unknown as {
    is_suspended?: boolean;
    billing_status?: string;
  };
  if (
    (ws.is_suspended || ws.billing_status === "suspended_for_nonpayment") &&
    !isImpersonating
  ) {
    redirect("/suspended");
  }

  // ── Visible modules for the current member ────────────────────────────────
  const { data: memberRecord } = await supabase
    .from("workspace_members")
    .select("visible_modules, role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", authUser.id)
    .maybeSingle();

  // Owners and superadmins see everything
  const visibleModules: string[] | undefined =
    isImpersonating ||
    userProfile.is_superadmin ||
    (workspace as { owner_id?: string }).owner_id === authUser.id
      ? undefined // undefined = show all
      : ((memberRecord as { visible_modules: string[] } | null)
          ?.visible_modules ?? undefined);

  // Billing state for standard vs enterprise clients
  const minuteCap =
    (workspace as { minute_cap?: number | null }).minute_cap ?? null;
  const balanceCents =
    (workspace as { stripe_balance_cents?: number }).stripe_balance_cents ?? 0;
  const isEnterprise = minuteCap !== null;
  void balanceCents;

  // Unified account state — the single source shared with the header minutes
  // pill, so the banner can never say "inactive" while the header shows minutes.
  const accountState = getAccountState(workspace as AccountStateInput);
  const minutesRemaining =
    Number(workspace.minutes_limit) - Number(workspace.minutes_used);
  const showActivationBanner =
    !isEnterprise && !isImpersonating && accountStateNeedsBanner(accountState);

  const unread = notifications.data?.length ?? 0;

  const branding = (workspace.branding ?? null) as WorkspaceBranding | null;
  const appName = branding?.app_name ?? "VoiceOS";
  const primaryColor = branding?.primary_color ?? "#0a0a0a";
  const hasComplianceQa = !!(
    workspace as unknown as { has_compliance_qa?: boolean }
  ).has_compliance_qa;

  const isOwner = (workspace as { owner_id?: string }).owner_id === authUser.id;
  const memberRole = (memberRecord as { role?: string } | null)?.role ?? null;
  const isQaAdmin =
    userProfile.is_superadmin || isOwner || memberRole === "admin";

  return (
    <div
      className="flex min-h-screen app-bg"
      style={{ "--brand": primaryColor } as React.CSSProperties}
    >
      {isImpersonating && (
        <ImpersonationBanner
          workspaceId={impersonatingWorkspaceId!}
          workspaceName={
            (workspace as unknown as { name?: string }).name ??
            impersonatingWorkspaceId!
          }
        />
      )}
      <div className="hidden md:block">
        <Sidebar
          isSuperadmin={userProfile.is_superadmin}
          appName={appName}
          visibleModules={visibleModules}
          hasComplianceQa={hasComplianceQa}
          isQaAdmin={isQaAdmin}
        />
      </div>
      <RouteGuard visibleModules={visibleModules} />
      <div
        className={`flex flex-1 flex-col md:pl-56 ${isImpersonating ? "mt-10" : ""}`}
      >
        <Header
          user={userProfile}
          workspace={workspace}
          unreadNotifications={unread}
        />
        {/* Activation / trial banner — driven by the unified account state */}
        {showActivationBanner && userProfile.onboarding_completed && (
          <div className="pt-14">
            <ActivationBanner
              workspaceId={workspace.id}
              state={accountState}
              minutesRemaining={minutesRemaining}
            />
          </div>
        )}
        {/* Enterprise quota bar — replaces Stripe balance for minute_cap clients */}
        {isEnterprise && !isImpersonating && (
          <div className="pt-14">
            <EnterpriseQuotaBar
              used={Number(workspace.minutes_used)}
              cap={minuteCap!}
            />
          </div>
        )}
        <main
          className={`flex-1 pb-24 md:pb-24 ${showActivationBanner || isEnterprise ? "" : "pt-14"}`}
        >
          {children}
        </main>
      </div>
      <MobileNav />
      <CommandPalette />
      {!userProfile.onboarding_completed && !isImpersonating && (
        <OnboardingWizard
          userId={userProfile.id}
          userName={userProfile.name}
          workspaceId={workspace.id}
        />
      )}
      <MinuteAlerts
        workspaceId={workspace.id}
        initialUsed={Number(workspace.minutes_used)}
        limit={Number(workspace.minutes_limit)}
        plan={workspace.plan}
      />
      {!isImpersonating && <AnalyticsCopilot workspaceId={workspace.id} />}
    </div>
  );
}
