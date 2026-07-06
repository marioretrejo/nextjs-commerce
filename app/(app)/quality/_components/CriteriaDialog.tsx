"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { toast } from "sonner";
import type { QACriteria } from "@/lib/supabase/types";
import type { CriteriaForm } from "./types";

export function CriteriaDialog({
  open,
  onOpenChange,
  agentId,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  editing: QACriteria | null;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<CriteriaForm>({
    name: "",
    description: "",
    weight: 50,
  });
  const [saving, setSaving] = useState(false);

  // Sync form when dialog opens for add/edit
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? "",
        weight: editing.weight,
      });
    } else {
      setForm({ name: "", description: "", weight: 50 });
    }
  }, [open, editing]);

  async function saveCriteria() {
    if (!form.name.trim()) return;
    setSaving(true);
    const url = `/api/agents/${agentId}/criteria`;
    const method = editing ? "PATCH" : "POST";
    const body = editing ? { ...form, criteria_id: editing.id } : form;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await onSaved();
      onOpenChange(false);
      toast.success(editing ? "Criteria updated" : "Criteria added");
    } else {
      const err = (await res
        .json()
        .catch(() => ({ error: "Unknown error" }))) as { error?: string };
      toast.error(err.error ?? "Failed to save criteria");
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Criteria" : "Add QA Criteria"}
          </DialogTitle>
          <DialogDescription>
            Define a scoring criterion for call quality evaluation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="criteria-name">
              Name{" "}
              <FieldTooltip text="A short label for this criterion. Keep it clear and specific, e.g. 'Greeting Quality' or 'Objection Handling'." />
            </Label>
            <Input
              id="criteria-name"
              placeholder="e.g. Greeting quality"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="criteria-desc">
              Description{" "}
              <FieldTooltip text="Explain what the AI should evaluate. More detail helps the scoring model apply the criterion consistently across calls." />
            </Label>
            <Textarea
              id="criteria-desc"
              placeholder="Describe what this criterion evaluates…"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  description: e.target.value,
                }))
              }
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Weight{" "}
                <FieldTooltip text="How much this criterion contributes to the final QA score (0–100). All criteria weights are normalised, so relative proportions matter more than absolute values." />
              </Label>
              <span className="text-sm font-medium text-[#0a0a0a]">
                {form.weight}%
              </span>
            </div>
            <Slider
              min={1}
              max={100}
              step={1}
              value={[form.weight]}
              onValueChange={([v]) =>
                setForm((f) => ({ ...f, weight: v ?? f.weight }))
              }
            />
            <p className="text-xs text-[#6b6b6b]">
              Relative importance of this criterion in the overall score.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={saveCriteria} disabled={saving || !form.name.trim()}>
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Criteria"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
