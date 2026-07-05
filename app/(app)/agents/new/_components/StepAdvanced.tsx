"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { type FormState, type SetField } from "./constants";

export function StepAdvanced({
  form,
  setField,
  dynVars,
  updateDynVars,
}: {
  form: FormState;
  setField: SetField;
  dynVars: { key: string; value: string }[];
  updateDynVars: (entries: { key: string; value: string }[]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Advanced Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>
            Branded Caller ID{" "}
            <FieldTooltip text="The name displayed on the recipient's phone screen. Requires CNAM registration with your phone provider. Leave blank to use the number." />
          </Label>
          <Input
            placeholder="Acme Inc."
            value={form.branded_caller_id}
            onChange={(e) => setField("branded_caller_id", e.target.value)}
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={form.transfer_enabled}
              onCheckedChange={(v) => setField("transfer_enabled", v)}
            />
            <Label>Enable Call Transfer</Label>
          </div>
          {form.transfer_enabled && (
            <div className="ml-8 space-y-3 border-l-2 border-[#e0e0e0] pl-4">
              <div className="space-y-1.5">
                <Label>Transfer Number</Label>
                <Input
                  placeholder="+1234567890"
                  value={form.transfer_number}
                  onChange={(e) => setField("transfer_number", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Transfer Type</Label>
                <Select
                  value={form.transfer_type}
                  onValueChange={(v) =>
                    setField("transfer_type", v as "warm" | "cold")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warm">
                      Warm (announce before transfer)
                    </SelectItem>
                    <SelectItem value="cold">Cold (blind transfer)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Transfer Condition</Label>
                <Input
                  placeholder="e.g. When prospect asks to speak to a human"
                  value={form.transfer_condition}
                  onChange={(e) =>
                    setField("transfer_condition", e.target.value)
                  }
                />
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {[
            {
              key: "interruption_handling" as const,
              label: "Interruption Handling",
              desc: "Allow caller to interrupt the agent",
            },
            {
              key: "noise_cancellation" as const,
              label: "Noise Cancellation",
              desc: "Filter background noise from calls",
            },
            {
              key: "ivr_mode" as const,
              label: "IVR Mode",
              desc: "Navigate phone trees automatically",
            },
            {
              key: "dtmf_enabled" as const,
              label: "DTMF (Keypad)",
              desc: "Send touch-tone keypad inputs",
            },
            {
              key: "post_call_analysis_enabled" as const,
              label: "Post-Call Analysis",
              desc: "Auto-generate summary and extracted data",
            },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-start gap-3">
              <Switch
                className="mt-0.5"
                checked={form[key]}
                onCheckedChange={(v) => setField(key, v)}
              />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-[#6b6b6b]">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <Label>
                Dynamic Variables{" "}
                <FieldTooltip text="Key-value pairs injected into your system prompt at call time. Reference them with [key_name] syntax. Example: key='company', value='Acme Inc.'." />
              </Label>
              <p className="text-xs text-[#6b6b6b]">
                Variables injected into prompts at call time.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                updateDynVars([...dynVars, { key: "", value: "" }])
              }
            >
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
          {dynVars.map((entry, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                placeholder="key"
                value={entry.key}
                onChange={(e) => {
                  const next = [...dynVars];
                  next[idx] = { ...next[idx]!, key: e.target.value };
                  updateDynVars(next);
                }}
                className="font-mono text-sm"
              />
              <Input
                placeholder="value"
                value={entry.value}
                onChange={(e) => {
                  const next = [...dynVars];
                  next[idx] = { ...next[idx]!, value: e.target.value };
                  updateDynVars(next);
                }}
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  updateDynVars(dynVars.filter((_, i) => i !== idx))
                }
              >
                <Trash2 className="h-3.5 w-3.5 text-[#6b6b6b]" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
