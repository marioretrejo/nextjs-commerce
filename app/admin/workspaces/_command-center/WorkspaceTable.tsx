"use client";

import {
  Shield,
  ShieldOff,
  LogIn,
  ChevronDown,
  ChevronUp,
  Settings2,
  Search,
  Zap,
  Building2,
  BanknoteIcon,
  Palette,
  CreditCard,
  X,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
import { FLAG_LABELS, ABUSE_THRESHOLD } from "./types";
import { StatsBar } from "./StatsBar";
import type { CommandCenterState } from "./useWorkspaceCommandCenter";

export function WorkspaceTable({ cc }: { cc: CommandCenterState }) {
  const {
    workspaces,
    setWorkspaces,
    search,
    setSearch,
    expanded,
    setExpanded,
    loading,
    setImpersonateTarget,
    setSuspendTarget,
    setNonpayTarget,
    rejectionCounts,
    runUnsuspend,
    toggleQaAccess,
    runNonPaymentUnsuspend,
    toggleFlag,
    openQuotaModal,
    openPlanModal,
    openBrandingModal,
  } = cc;
  const filtered = workspaces.filter(
    (w) =>
      !search ||
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.owner?.email.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a1a1a]">
            Workspace Command Center
          </h1>
          <p className="text-sm text-[#6b6b6b] mt-0.5">
            {workspaces.length} workspaces · suspend, impersonate, and configure
            feature flags
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2">
          <Search className="h-4 w-4 text-[#a0a0a0]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workspaces or email…"
            className="w-52 text-sm outline-none placeholder:text-[#c0c0c0]"
          />
        </div>
      </div>

      {/* Stats bar */}
      <StatsBar workspaces={workspaces} rejectionCounts={rejectionCounts} />

      {/* Workspace rows */}
      <div className="space-y-2">
        {filtered.map((ws) => (
          <div
            key={ws.id}
            className={`rounded-xl border bg-white transition-shadow ${
              ws.is_suspended
                ? "border-red-200 bg-red-50/30"
                : "border-[#e5e5e5]"
            }`}
          >
            {/* Main row */}
            <div className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[#1a1a1a] truncate">
                    {ws.name}
                  </span>
                  <Badge
                    variant={ws.plan === "scale" ? "default" : "secondary"}
                    className="text-[10px] uppercase"
                  >
                    {ws.plan}
                  </Badge>
                  {ws.is_suspended && (
                    <Badge variant="destructive" className="text-[10px]">
                      Suspended
                    </Badge>
                  )}
                  {(rejectionCounts[ws.id] ?? 0) >= ABUSE_THRESHOLD && (
                    <span
                      title={`${rejectionCounts[ws.id]} API rate-limit rejections in the last hour`}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200"
                    >
                      <Zap className="h-2.5 w-2.5" />
                      High API Rejection Rate ({rejectionCounts[ws.id]}/hr)
                    </span>
                  )}
                  {ws.billing_status === "suspended_for_nonpayment" && (
                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
                      <BanknoteIcon className="h-2.5 w-2.5" />
                      Non-Payment
                    </span>
                  )}
                  {ws.minute_cap != null && (
                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                      <Building2 className="h-2.5 w-2.5" />
                      Enterprise — {ws.minute_cap.toLocaleString()} min cuota
                    </span>
                  )}
                  {ws.branding && (
                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200">
                      <Palette className="h-2.5 w-2.5" />
                      {ws.branding.app_name}
                    </span>
                  )}
                  {ws.has_compliance_qa && (
                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      QA
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#a0a0a0] mt-0.5 truncate">
                  {ws.owner?.email ?? "No owner"} · {ws.active_calls} active
                  calls ·{" "}
                  {Math.round(
                    (ws.minutes_used / Math.max(ws.minutes_limit, 1)) * 100,
                  )}
                  % minutes used
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {/* Impersonate → opens confirmation modal */}
                <button
                  onClick={() => setImpersonateTarget(ws)}
                  disabled={loading[ws.id]}
                  className="flex items-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-medium text-[#1a1a1a] hover:bg-[#f5f5f5] transition-colors disabled:opacity-50"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Log in as
                </button>

                {/* Suspend → modal  |  Unsuspend → direct */}
                {ws.is_suspended ? (
                  <button
                    onClick={() => runUnsuspend(ws)}
                    disabled={loading[ws.id]}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <ShieldOff className="h-3.5 w-3.5" />
                    Reinstate
                  </button>
                ) : (
                  <button
                    onClick={() => setSuspendTarget(ws)}
                    disabled={loading[ws.id]}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Suspend
                  </button>
                )}

                {/* Enterprise Quota */}
                <button
                  onClick={() => openQuotaModal(ws)}
                  disabled={loading[ws.id]}
                  className="flex items-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50"
                  title="Assign or clear enterprise minute cap"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {ws.minute_cap != null ? "Edit Quota" : "Set Quota"}
                </button>

                {/* Non-payment suspend / reinstate */}
                {ws.billing_status === "suspended_for_nonpayment" ? (
                  <button
                    onClick={() => runNonPaymentUnsuspend(ws)}
                    disabled={loading[ws.id]}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Reinstate
                  </button>
                ) : (
                  <button
                    onClick={() => setNonpayTarget(ws)}
                    disabled={loading[ws.id]}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Suspend for non-payment"
                  >
                    <BanknoteIcon className="h-3.5 w-3.5" /> Non-Pay
                  </button>
                )}

                {/* QA Center Access */}
                <button
                  onClick={() => toggleQaAccess(ws)}
                  disabled={loading[ws.id]}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    ws.has_compliance_qa
                      ? "border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border-[#e5e5e5] bg-white text-[#6b6b6b] hover:bg-[#f5f5f5]"
                  }`}
                  title={
                    ws.has_compliance_qa
                      ? "Click to revoke QA Center access"
                      : "Click to grant QA Center access"
                  }
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {ws.has_compliance_qa ? "QA On" : "QA Off"}
                </button>

                {/* Plan */}
                <button
                  onClick={() => openPlanModal(ws)}
                  disabled={loading[ws.id]}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 transition-colors disabled:opacity-50"
                  title="Change billing plan"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  {ws.plan.charAt(0).toUpperCase() + ws.plan.slice(1)}
                </button>

                {/* White-label Branding */}
                <button
                  onClick={() => openBrandingModal(ws)}
                  disabled={loading[ws.id]}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 hover:border-violet-400 transition-colors disabled:opacity-50"
                  title="Set white-label branding"
                >
                  <Palette className="h-3.5 w-3.5" />
                  Design
                </button>

                {/* Feature flags expand */}
                <button
                  onClick={() =>
                    setExpanded((p) => (p === ws.id ? null : ws.id))
                  }
                  className="flex items-center gap-1 rounded-lg border border-[#e5e5e5] px-2.5 py-1.5 text-xs text-[#606060] hover:bg-[#f5f5f5] transition-colors"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Flags
                  {expanded === ws.id ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>

            {/* Feature flags panel */}
            {expanded === ws.id && (
              <div className="border-t border-[#f0f0f0] px-4 py-3">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#a0a0a0]">
                  Feature Flags
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {Object.entries(FLAG_LABELS).map(([flag, label]) => {
                    const current = ws.flags.find((f) => f.flag === flag);
                    const enabled = current?.enabled ?? true;
                    return (
                      <label
                        key={flag}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-xs"
                      >
                        <span className="font-medium text-[#1a1a1a]">
                          {label}
                        </span>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) =>
                            toggleFlag(ws, flag, e.target.checked)
                          }
                          className="ml-2 h-3.5 w-3.5 accent-[#0a0a0a]"
                        />
                      </label>
                    );
                  })}
                </div>
                {/* Upsell module entitlements */}
                <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-widest text-[#a0a0a0]">
                  Module Entitlements (Upsell)
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                    <span className="font-medium text-emerald-800">
                      Compliance & QA
                    </span>
                    <input
                      type="checkbox"
                      checked={ws.has_compliance_qa ?? false}
                      onChange={async (e) => {
                        const enabled = e.target.checked;
                        try {
                          const res = await fetch(
                            `/api/admin/workspaces/${ws.id}/compliance-qa`,
                            {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ enabled }),
                            },
                          );
                          if (!res.ok)
                            throw new Error(
                              ((await res.json()) as { error: string }).error,
                            );
                          setWorkspaces((prev) =>
                            prev.map((w) =>
                              w.id === ws.id
                                ? { ...w, has_compliance_qa: enabled }
                                : w,
                            ),
                          );
                          toast.success(
                            `Compliance QA ${enabled ? "enabled" : "disabled"} for "${ws.name}"`,
                          );
                        } catch (e) {
                          toast.error(String(e));
                        }
                      }}
                      className="ml-2 h-3.5 w-3.5 accent-emerald-600"
                    />
                  </label>
                </div>

                {ws.is_suspended && ws.suspended_reason && (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    <strong>Suspension reason:</strong> {ws.suspended_reason}
                    {ws.suspended_at &&
                      ` · ${format(new Date(ws.suspended_at), "PPp")}`}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-[#a0a0a0]">
            No workspaces found.
          </div>
        )}
      </div>
    </div>
  );
}
