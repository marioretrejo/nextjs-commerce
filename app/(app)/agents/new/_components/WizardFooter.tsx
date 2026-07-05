"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STEPS } from "./constants";

export function WizardFooter({
  step,
  saving,
  nextDisabled,
  onBack,
  onNext,
  onSave,
}: {
  step: number;
  saving: boolean;
  nextDisabled: boolean;
  onBack: () => void;
  onNext: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex justify-between">
      <Button variant="secondary" onClick={onBack} disabled={saving}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Back
      </Button>
      {step < STEPS.length - 1 ? (
        <Button onClick={onNext} disabled={nextDisabled}>
          Next <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      ) : (
        <Button onClick={onSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating…
            </>
          ) : (
            "Create Agent"
          )}
        </Button>
      )}
    </div>
  );
}
