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
import { Switch } from "@/components/ui/switch";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { LANGUAGES, type FormState, type SetField } from "./constants";

export function StepBasics({
  form,
  setField,
}: {
  form: FormState;
  setField: SetField;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Agent Name *</Label>
          <Input
            placeholder="e.g. Sales SDR, Appointment Setter"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            Language{" "}
            <FieldTooltip text="The primary language the agent will speak. This also controls the speech recognition model used during calls." />
          </Label>
          <Select
            value={form.language}
            onValueChange={(v) => setField("language", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={form.auto_language_detection}
            onCheckedChange={(v) => setField("auto_language_detection", v)}
          />
          <div>
            <Label>
              Auto Language Detection{" "}
              <FieldTooltip text="When enabled, the agent will detect the caller's language on the first turn and switch automatically. Useful for multilingual markets." />
            </Label>
            <p className="text-xs text-[#6b6b6b]">
              Detect and match the caller&apos;s language automatically
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
