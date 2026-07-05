"use client";

import { ArrowLeft, Layers } from "lucide-react";
import { STEPS, type AgentTemplate } from "./constants";

export function WizardHeader({
  step,
  fromTemplate,
  autosaveStatus,
  onBack,
  onClearDraft,
}: {
  step: number;
  fromTemplate: AgentTemplate | null;
  autosaveStatus: "idle" | "saved";
  onBack: () => void;
  onClearDraft: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-[#6b6b6b] hover:text-[#0a0a0a] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Agent</h1>
          <p className="text-sm text-[#6b6b6b]">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {autosaveStatus === "saved" && (
            <span className="text-xs text-[#6b6b6b]">Draft saved</span>
          )}
          <button
            onClick={onClearDraft}
            className="text-xs text-[#6b6b6b] hover:text-[#0a0a0a] underline underline-offset-2 transition-colors"
          >
            Clear draft
          </button>
        </div>
      </div>
      {fromTemplate && (
        <div className="flex items-center gap-2 rounded-md border border-[#e0e0e0] bg-[#f5f5f5] px-4 py-2.5 text-sm text-[#6b6b6b]">
          <Layers className="w-4 h-4 shrink-0" />
          Template:{" "}
          <span className="font-medium text-[#0a0a0a]">
            {fromTemplate.name}
          </span>
        </div>
      )}
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-[#0a0a0a]" : "bg-[#e0e0e0]"}`}
          />
        ))}
      </div>{" "}
    </>
  );
}
