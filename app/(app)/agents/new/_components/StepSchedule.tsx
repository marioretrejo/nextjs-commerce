"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { DAYS, TIMEZONES, type FormState, type SetField } from "./constants";

export function StepSchedule({
  form,
  setField,
  toggleDay,
}: {
  form: FormState;
  setField: SetField;
  toggleDay: (day: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Call Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Active Days</Label>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((d) => (
              <button
                key={d.id}
                onClick={() => toggleDay(d.id)}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${form.schedule_days.includes(d.id) ? "border-[#0a0a0a] bg-[#0a0a0a] text-white" : "border-[#e0e0e0] hover:border-[#0a0a0a]"}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Start Time</Label>
            <Input
              type="time"
              value={form.schedule_start_time}
              onChange={(e) => setField("schedule_start_time", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>End Time</Label>
            <Input
              type="time"
              value={form.schedule_end_time}
              onChange={(e) => setField("schedule_end_time", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Timezone</Label>
          <Select
            value={form.timezone}
            onValueChange={(v) => setField("timezone", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>
              Max Attempts{" "}
              <FieldTooltip text="How many times the agent will call a contact if they don't answer. Each unanswered call counts. Recommended: 3–5." />
            </Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={form.max_attempts}
              onChange={(e) => setField("max_attempts", Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Retry Interval (min){" "}
              <FieldTooltip text="Minutes to wait before calling a contact again after a no-answer. Minimum 15 minutes. Recommended: 60–240 minutes." />
            </Label>
            <Input
              type="number"
              min={15}
              value={form.retry_interval_minutes}
              onChange={(e) =>
                setField("retry_interval_minutes", Number(e.target.value))
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
