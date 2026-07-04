"use client";

import { useState } from "react";
import { AlertTriangle, CreditCard, Sparkles, X } from "lucide-react";
import { TopUpModal } from "./TopUpModal";
import type { AccountState } from "@/lib/account-state";

interface Props {
  workspaceId: string;
  /** Unified account state — the single source shared with the header pill. */
  state: AccountState;
  /** Remaining trial minutes, shown for the soft trial banner. */
  minutesRemaining?: number;
}

export function ActivationBanner({
  workspaceId,
  state,
  minutesRemaining,
}: Props) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // paid_active / suspended never render this banner (suspension redirects).
  if (
    dismissed ||
    (state !== "trial_active" &&
      state !== "trial_exhausted" &&
      state !== "inactive")
  ) {
    return null;
  }

  // ── Soft trial banner: active trial with minutes left — NOT "inactive". ──
  if (state === "trial_active") {
    const mins = Math.max(0, Math.floor(minutesRemaining ?? 0));
    return (
      <>
        <div className="flex w-full items-center gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2.5">
          <Sparkles className="h-4 w-4 shrink-0 text-blue-600" />
          <p className="flex-1 text-sm text-blue-800">
            <span className="font-semibold">
              You&apos;re on the free trial.
            </span>{" "}
            {mins} free minute{mins === 1 ? "" : "s"} remaining — upgrade
            anytime to unlock more.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <CreditCard className="h-3.5 w-3.5" />
            Upgrade
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-blue-400 transition-colors hover:text-blue-600"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <TopUpModal
          open={open}
          onClose={() => setOpen(false)}
          workspaceId={workspaceId}
        />
      </>
    );
  }

  // ── trial_exhausted / inactive: attention banner to add credit. ──
  const isTrial = state === "trial_exhausted";
  return (
    <>
      <div className="flex w-full items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        <p className="flex-1 text-sm text-amber-800">
          <span className="font-semibold">
            {isTrial
              ? "Your free trial minutes are used up."
              : "Your account is inactive."}
          </span>{" "}
          Add credit to{" "}
          {isTrial
            ? "keep making calls"
            : "activate your AI agents and start making calls"}
          .
        </p>
        <button
          onClick={() => setOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
        >
          <CreditCard className="h-3.5 w-3.5" />
          Add Credit
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-500 transition-colors hover:text-amber-700"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <TopUpModal
        open={open}
        onClose={() => setOpen(false)}
        workspaceId={workspaceId}
      />
    </>
  );
}
