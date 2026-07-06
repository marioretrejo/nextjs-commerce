"use client";

import { Building2, BanknoteIcon, X, Palette, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ImpersonateConfirmModal } from "@/components/admin/ImpersonateConfirmModal";
import { SuspendModal } from "@/components/admin/SuspendModal";
import type { CommandCenterState } from "./useWorkspaceCommandCenter";

export function WorkspaceModals({ cc }: { cc: CommandCenterState }) {
  const {
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
    saveQuota,
    savePlan,
    saveBranding,
    runNonPaymentSuspend,
  } = cc;
  return (
    <>
      <ImpersonateConfirmModal
        workspace={
          impersonateTarget
            ? {
                id: impersonateTarget.id,
                name: impersonateTarget.name,
                owner: impersonateTarget.owner,
              }
            : null
        }
        onConfirm={() => runImpersonate(impersonateTarget!)}
        onClose={() => setImpersonateTarget(null)}
      />
      <SuspendModal
        workspace={suspendTarget}
        onConfirm={(reason) => runSuspend(suspendTarget!, reason)}
        onClose={() => setSuspendTarget(null)}
      />

      {/* Enterprise Quota Modal */}
      <Dialog
        open={!!quotaTarget}
        onOpenChange={(o) => {
          if (!o) setQuotaTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Assign Enterprise Quota
            </DialogTitle>
            <DialogDescription>
              Set a prepaid minute cap for <strong>{quotaTarget?.name}</strong>.
              When set, Stripe balance is ignored and minutes are consumed from
              this pool. Leave empty to clear (revert to standard Stripe
              billing).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Minute Cap</Label>
            <Input
              type="number"
              min={0}
              placeholder="e.g. 10000"
              value={quotaInput}
              onChange={(e) => setQuotaInput(e.target.value)}
            />
            <p className="text-xs text-[#6b6b6b]">
              Leave blank to clear enterprise quota (back to Stripe
              pay-as-you-go).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotaTarget(null)}>
              Cancel
            </Button>
            <Button onClick={saveQuota} disabled={quotaLoading}>
              {quotaLoading ? "Saving…" : "Save Quota"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan Change Modal */}
      <Dialog
        open={!!planTarget}
        onOpenChange={(o) => {
          if (!o) setPlanTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              Change Plan — {planTarget?.name}
            </DialogTitle>
            <DialogDescription>
              Select the billing plan for this workspace. This updates
              immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(["free", "pro", "scale", "enterprise"] as const).map((p) => (
              <label
                key={p}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  planValue === p
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-[#e5e5e5] hover:border-emerald-200 hover:bg-[#f9f9f9]"
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value={p}
                  checked={planValue === p}
                  onChange={() => setPlanValue(p)}
                  className="accent-emerald-600"
                />
                <div>
                  <p className="text-sm font-semibold capitalize text-[#1a1a1a]">
                    {p}
                  </p>
                  <p className="text-xs text-[#9b9b9b]">
                    {p === "free" && "Basic access, no outbound calls"}
                    {p === "pro" && "Full features, pay-as-you-go"}
                    {p === "scale" && "High-volume, priority support"}
                    {p === "enterprise" &&
                      "Custom contract, minute cap billing"}
                  </p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={savePlan}
              disabled={planLoading || planValue === planTarget?.plan}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {planLoading ? "Saving…" : "Save Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* White-label Branding Modal */}
      <Dialog
        open={!!brandingTarget}
        onOpenChange={(o) => {
          if (!o) setBrandingTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-violet-600" />
              White-label Branding — {brandingTarget?.name}
            </DialogTitle>
            <DialogDescription>
              Personaliza el nombre, logo y color para este cliente. Deja{" "}
              <strong>App Name</strong> en blanco para desactivar el branding
              personalizado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>App Name</Label>
              <Input
                placeholder="Ej. AcmeCalls, SalesBot Pro…"
                value={brandingForm.app_name}
                onChange={(e) =>
                  setBrandingForm((f) => ({ ...f, app_name: e.target.value }))
                }
              />
              <p className="text-xs text-[#6b6b6b]">
                Reemplaza &ldquo;VoiceOS&rdquo; en la barra lateral y título de
                pestaña.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>
                Logo URL <span className="text-[#a0a0a0]">(opcional)</span>
              </Label>
              <Input
                placeholder="https://cdn.empresa.com/logo.png"
                value={brandingForm.logo_url}
                onChange={(e) =>
                  setBrandingForm((f) => ({ ...f, logo_url: e.target.value }))
                }
              />
              <p className="text-xs text-[#6b6b6b]">
                PNG/SVG recomendado, fondo transparente, ~120×32px.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Color primario</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandingForm.primary_color}
                  onChange={(e) =>
                    setBrandingForm((f) => ({
                      ...f,
                      primary_color: e.target.value,
                    }))
                  }
                  className="h-9 w-14 cursor-pointer rounded border border-[#e5e5e5] p-0.5"
                />
                <Input
                  placeholder="#0a0a0a"
                  value={brandingForm.primary_color}
                  onChange={(e) =>
                    setBrandingForm((f) => ({
                      ...f,
                      primary_color: e.target.value,
                    }))
                  }
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>
            {brandingTarget?.branding && (
              <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-700 border border-violet-100">
                ✓ Branding activo — App:{" "}
                <strong>{brandingTarget.branding.app_name}</strong>
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            {brandingTarget?.branding && (
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => {
                  setBrandingForm({
                    app_name: "",
                    logo_url: "",
                    primary_color: "#0a0a0a",
                  });
                }}
              >
                <X className="mr-1.5 h-3.5 w-3.5" /> Limpiar
              </Button>
            )}
            <Button variant="outline" onClick={() => setBrandingTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={saveBranding}
              disabled={brandingLoading}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {brandingLoading ? "Guardando…" : "Guardar Branding"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Non-payment suspend confirm */}
      <Dialog
        open={!!nonpayTarget}
        onOpenChange={(o) => {
          if (!o) setNonpayTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <BanknoteIcon className="h-5 w-5" />
              Suspend for Non-Payment
            </DialogTitle>
            <DialogDescription>
              This will immediately block all dashboard access and API calls for{" "}
              <strong>{nonpayTarget?.name}</strong>. Users will see a suspension
              message. You can reinstate at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNonpayTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => runNonPaymentSuspend(nonpayTarget!)}
              disabled={!!loading[nonpayTarget?.id ?? ""]}
            >
              Suspend for Non-Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
