"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FLAG_LABELS, type WorkspaceRow } from "./types";

export function useWorkspaceCommandCenter(initial: WorkspaceRow[]) {
  const [workspaces, setWorkspaces] = useState(initial);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [impersonateTarget, setImpersonateTarget] =
    useState<WorkspaceRow | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<WorkspaceRow | null>(null);
  const [quotaTarget, setQuotaTarget] = useState<WorkspaceRow | null>(null);
  const [quotaInput, setQuotaInput] = useState("");
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [nonpayTarget, setNonpayTarget] = useState<WorkspaceRow | null>(null);
  const [rejectionCounts, setRejectionCounts] = useState<
    Record<string, number>
  >({});
  // Plan modal state
  const [planTarget, setPlanTarget] = useState<WorkspaceRow | null>(null);
  const [planValue, setPlanValue] = useState<string>("free");
  const [planLoading, setPlanLoading] = useState(false);
  // Branding modal state
  const [brandingTarget, setBrandingTarget] = useState<WorkspaceRow | null>(
    null,
  );
  const [brandingForm, setBrandingForm] = useState({
    app_name: "",
    logo_url: "",
    primary_color: "#0a0a0a",
  });
  const [brandingLoading, setBrandingLoading] = useState(false);
  const router = useRouter();

  // Fetch 429 rejection counts from Redis (last hour) on mount
  useEffect(() => {
    const ids = initial.map((w) => w.id);
    if (!ids.length) return;
    fetch(`/api/admin/rate-limit-stats?workspaceIds=${ids.join(",")}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("stats"))))
      .then((d: { counts?: Record<string, number> }) =>
        setRejectionCounts(d.counts ?? {}),
      )
      .catch(() => null);
  }, [initial]);

  const setWsLoading = (id: string, v: boolean) =>
    setLoading((p) => ({ ...p, [id]: v }));

  const runImpersonate = useCallback(
    async (ws: WorkspaceRow) => {
      setWsLoading(ws.id, true);
      try {
        const res = await fetch(`/api/admin/workspaces/${ws.id}/impersonate`, {
          method: "POST",
        });
        if (!res.ok)
          throw new Error(((await res.json()) as { error: string }).error);
        const { token } = (await res.json()) as { token: string };
        document.cookie = `vos-impersonation=${token}; path=/; max-age=7200; SameSite=Lax`;
        toast.success(`Entering "${ws.name}" workspace…`);
        router.push("/dashboard");
        router.refresh();
      } catch (e) {
        toast.error(String(e));
      } finally {
        setWsLoading(ws.id, false);
        setImpersonateTarget(null);
      }
    },
    [router],
  );

  const runSuspend = useCallback(async (ws: WorkspaceRow, reason: string) => {
    setWsLoading(ws.id, true);
    try {
      const res = await fetch(
        `/api/admin/workspaces/${ws.id}/suspend?action=suspend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === ws.id
            ? { ...w, is_suspended: true, suspended_reason: reason }
            : w,
        ),
      );
      toast.success(`"${ws.name}" suspended`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setWsLoading(ws.id, false);
      setSuspendTarget(null);
    }
  }, []);

  const runUnsuspend = useCallback(async (ws: WorkspaceRow) => {
    setWsLoading(ws.id, true);
    try {
      const res = await fetch(
        `/api/admin/workspaces/${ws.id}/suspend?action=unsuspend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === ws.id
            ? { ...w, is_suspended: false, suspended_reason: null }
            : w,
        ),
      );
      toast.success(`"${ws.name}" reinstated`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setWsLoading(ws.id, false);
    }
  }, []);

  const openQuotaModal = (ws: WorkspaceRow) => {
    setQuotaInput(ws.minute_cap != null ? String(ws.minute_cap) : "");
    setQuotaTarget(ws);
  };

  const saveQuota = useCallback(async () => {
    if (!quotaTarget) return;
    setQuotaLoading(true);
    const minuteCap = quotaInput.trim() === "" ? null : Number(quotaInput);
    try {
      const res = await fetch(
        `/api/admin/workspaces/${quotaTarget.id}/enterprise-quota`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minute_cap: minuteCap }),
        },
      );
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === quotaTarget.id ? { ...w, minute_cap: minuteCap } : w,
        ),
      );
      toast.success(
        minuteCap === null
          ? `Enterprise quota cleared for "${quotaTarget.name}"`
          : `Enterprise quota set to ${minuteCap.toLocaleString()} min for "${quotaTarget.name}"`,
      );
      setQuotaTarget(null);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setQuotaLoading(false);
    }
  }, [quotaTarget, quotaInput]);

  const openPlanModal = (ws: WorkspaceRow) => {
    setPlanValue(ws.plan);
    setPlanTarget(ws);
  };

  const savePlan = useCallback(async () => {
    if (!planTarget) return;
    setPlanLoading(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${planTarget.id}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planValue }),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === planTarget.id ? { ...w, plan: planValue } : w,
        ),
      );
      toast.success(`Plan changed to "${planValue}" for "${planTarget.name}"`);
      setPlanTarget(null);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setPlanLoading(false);
    }
  }, [planTarget, planValue]);

  const toggleQaAccess = useCallback(async (ws: WorkspaceRow) => {
    const enabled = !ws.has_compliance_qa;
    try {
      const res = await fetch(`/api/admin/workspaces/${ws.id}/compliance-qa`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === ws.id ? { ...w, has_compliance_qa: enabled } : w,
        ),
      );
      toast.success(
        `QA Center ${enabled ? "enabled" : "disabled"} for "${ws.name}"`,
      );
    } catch (e) {
      toast.error(String(e));
    }
  }, []);

  const openBrandingModal = (ws: WorkspaceRow) => {
    setBrandingForm({
      app_name: ws.branding?.app_name ?? "",
      logo_url: ws.branding?.logo_url ?? "",
      primary_color: ws.branding?.primary_color ?? "#0a0a0a",
    });
    setBrandingTarget(ws);
  };

  const saveBranding = useCallback(async () => {
    if (!brandingTarget) return;
    setBrandingLoading(true);
    const payload = brandingForm.app_name.trim()
      ? {
          app_name: brandingForm.app_name.trim(),
          logo_url: brandingForm.logo_url.trim() || null,
          primary_color: brandingForm.primary_color || "#0a0a0a",
        }
      : null; // clear branding if no app_name
    try {
      const res = await fetch(
        `/api/admin/workspaces/${brandingTarget.id}/branding`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === brandingTarget.id ? { ...w, branding: payload } : w,
        ),
      );
      toast.success(
        payload
          ? `Branding activado para "${brandingTarget.name}"`
          : `Branding eliminado para "${brandingTarget.name}"`,
      );
      setBrandingTarget(null);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBrandingLoading(false);
    }
  }, [brandingTarget, brandingForm]);

  const runNonPaymentSuspend = useCallback(async (ws: WorkspaceRow) => {
    setWsLoading(ws.id, true);
    try {
      const res = await fetch(`/api/admin/workspaces/${ws.id}/billing-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "suspended_for_nonpayment" }),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === ws.id
            ? { ...w, billing_status: "suspended_for_nonpayment" }
            : w,
        ),
      );
      toast.success(`"${ws.name}" suspended for non-payment`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setWsLoading(ws.id, false);
      setNonpayTarget(null);
    }
  }, []);

  const runNonPaymentUnsuspend = useCallback(async (ws: WorkspaceRow) => {
    setWsLoading(ws.id, true);
    try {
      const res = await fetch(`/api/admin/workspaces/${ws.id}/billing-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === ws.id ? { ...w, billing_status: "active" } : w,
        ),
      );
      toast.success(`"${ws.name}" billing status restored`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setWsLoading(ws.id, false);
    }
  }, []);

  const toggleFlag = useCallback(
    async (ws: WorkspaceRow, flag: string, enabled: boolean) => {
      try {
        const res = await fetch(`/api/admin/workspaces/${ws.id}/flags`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ flag, enabled }),
        });
        if (!res.ok)
          throw new Error(((await res.json()) as { error: string }).error);
        setWorkspaces((prev) =>
          prev.map((w) => {
            if (w.id !== ws.id) return w;
            const next = w.flags.map((f) =>
              f.flag === flag ? { ...f, enabled } : f,
            );
            if (!next.some((f) => f.flag === flag))
              next.push({ flag, enabled, value: null });
            return { ...w, flags: next };
          }),
        );
        toast.success(
          `${FLAG_LABELS[flag] ?? flag}: ${enabled ? "enabled" : "disabled"}`,
        );
      } catch (e) {
        toast.error(String(e));
      }
    },
    [],
  );

  return {
    workspaces,
    setWorkspaces,
    search,
    setSearch,
    expanded,
    setExpanded,
    loading,
    impersonateTarget,
    setImpersonateTarget,
    suspendTarget,
    setSuspendTarget,
    quotaTarget,
    setQuotaTarget,
    quotaInput,
    setQuotaInput,
    quotaLoading,
    nonpayTarget,
    setNonpayTarget,
    rejectionCounts,
    planTarget,
    setPlanTarget,
    planValue,
    setPlanValue,
    planLoading,
    brandingTarget,
    setBrandingTarget,
    brandingForm,
    setBrandingForm,
    brandingLoading,
    runImpersonate,
    runSuspend,
    runUnsuspend,
    saveQuota,
    savePlan,
    toggleQaAccess,
    saveBranding,
    runNonPaymentSuspend,
    runNonPaymentUnsuspend,
    toggleFlag,
    openQuotaModal,
    openPlanModal,
    openBrandingModal,
  };
}

export type CommandCenterState = ReturnType<typeof useWorkspaceCommandCenter>;
