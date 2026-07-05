"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QACInteraction } from "./types";
import {
  REVIEW_STATUSES,
  REVIEW_STATUS_LABEL,
  REVIEW_STATUS_COLOR,
} from "./config";

export function ReviewPanel({
  interaction,
  onUpdated,
}: {
  interaction: QACInteraction;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(interaction.review_status);
  const [notes, setNotes] = useState(interaction.reviewer_notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/qac/interactions/${interaction.id}/review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            review_status: status,
            reviewer_notes: notes,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to update review");
      setEditing(false);
      onUpdated();
      toast.success("Review updated");
    } catch {
      toast.error("Failed to save review status");
    } finally {
      setSaving(false);
    }
  }

  const colorCls =
    REVIEW_STATUS_COLOR[interaction.review_status] ??
    "text-gray-500 bg-gray-100 border-gray-200";

  return (
    <Card className="border-[#efefef]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#6b6b6b]" />
            Review
          </span>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-[#6b6b6b] hover:text-[#111] border border-[#e0e0e0] rounded-lg px-2 py-0.5 hover:border-[#111] transition-colors"
            >
              Edit
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <>
            <div>
              <label className="block text-[10px] font-medium text-[#9b9b9b] uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-sm text-[#111] focus:outline-none focus:ring-1 focus:ring-[#111]"
              >
                {REVIEW_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {REVIEW_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#9b9b9b] uppercase tracking-wider mb-1.5">
                Reviewer Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#111] focus:outline-none focus:ring-1 focus:ring-[#111] resize-none"
                placeholder="Add reviewer notes…"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void save()}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-[#111] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#333] disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setStatus(interaction.review_status);
                  setNotes(interaction.reviewer_notes ?? "");
                }}
                className="rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs text-[#6b6b6b] hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${colorCls}`}
            >
              {REVIEW_STATUS_LABEL[interaction.review_status] ??
                interaction.review_status}
            </span>
            {interaction.reviewer_notes && (
              <p className="text-xs text-[#555] leading-relaxed">
                {interaction.reviewer_notes}
              </p>
            )}
            {interaction.reviewed_at && (
              <p className="text-[10px] text-[#9b9b9b]">
                Reviewed{" "}
                {format(new Date(interaction.reviewed_at), "MMM d, yyyy HH:mm")}
              </p>
            )}
            {interaction.approved_at && (
              <p className="text-[10px] text-[#9b9b9b]">
                Approved{" "}
                {format(new Date(interaction.approved_at), "MMM d, yyyy HH:mm")}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── QA Comments Panel ────────────────────────────────────────────────────────
