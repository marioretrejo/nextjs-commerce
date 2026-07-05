"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LANGUAGES, type FormState } from "./constants";

export function StepReview({ form }: { form: FormState }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review & Create</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-[#e0e0e0] divide-y divide-[#e0e0e0]">
          {[
            { label: "Name", value: form.name },
            {
              label: "Language",
              value:
                LANGUAGES.find((l) => l.value === form.language)?.label ??
                form.language,
            },
            { label: "Voice", value: form.voice_name || form.voice_id },
            { label: "Objective", value: form.objective || "—" },
            {
              label: "Schedule",
              value: `${form.schedule_days.join(", ")} · ${form.schedule_start_time}–${form.schedule_end_time}`,
            },
            { label: "Max Attempts", value: String(form.max_attempts) },
            {
              label: "Transfer",
              value: form.transfer_enabled
                ? `${form.transfer_type} → ${form.transfer_number}`
                : "Disabled",
            },
            {
              label: "Post-Call Analysis",
              value: form.post_call_analysis_enabled ? "Enabled" : "Disabled",
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex justify-between px-4 py-2.5 text-sm"
            >
              <span className="text-[#6b6b6b]">{label}</span>
              <span className="font-medium max-w-[60%] text-right truncate">
                {value}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#6b6b6b]">
          The agent will be activated and ready to make calls immediately after
          creation.
        </p>
      </CardContent>
    </Card>
  );
}
