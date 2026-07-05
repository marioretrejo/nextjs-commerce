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
        <div className="flex w-full items-center gap-3 border-b border-[#e0e0e0] bg-[#f5f5f5] px-4 py-2.5">
          <Sparkles className="h-4 w-4 shrink-0 text-[#0a0a0a]" />
          <p className="flex-1 text-sm text-[#0a0a0a]">
            <span className="font-semibold">
              You&apos;re on the free trial.
            </span>{" "}
            <span className="text-[#6b6b6b]">
              {mins} free minute{mins === 1 ? "" : "s"} remaining — upgrade
              anytime to unlock more.
            </span>
          </p>
          <button
            onClick={() => setOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0a0a0a] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#3a3a3a]"
          >
            <CreditCard className="h-3.5 w-3.5" />
            Upgrade
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-[#6b6b6b] transition-colors hover:text-[#0a0a0a]"
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
      <div className="flex w-full items-center gap-3 border-b border-[#0a0a0a] bg-[#0a0a0a] px-4 py-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-white" />
        <p className="flex-1 text-sm text-white">
          <span className="font-semibold">
            {isTrial
              ? "Your free trial minutes are used up."
              : "Your account is inactive."}
          </span>{" "}
          <span className="text-[#b5b5b5]">
            Add credit to{" "}
            {isTrial
              ? "keep making calls"
              : "activate your AI agents and start making calls"}
            .
          </span>
        </p>
        <button
          onClick={() => setOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#0a0a0a] transition-colors hover:bg-[#e0e0e0]"
        >
          <CreditCard className="h-3.5 w-3.5" />
          Add Credit
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-[#b5b5b5] transition-colors hover:text-white"
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
