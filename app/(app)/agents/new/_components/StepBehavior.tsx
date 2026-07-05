"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { type FormState, type SetField } from "./constants";

export function StepBehavior({
  form,
  setField,
}: {
  form: FormState;
  setField: SetField;
}) {
  const tokenCount = Math.ceil(form.system_prompt.length / 4);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Behavior & Prompt</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Objective</Label>
          <Input
            placeholder="e.g. Schedule a product demo with qualified leads"
            value={form.objective}
            onChange={(e) => setField("objective", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Personality</Label>
          <Input
            placeholder="e.g. Professional, empathetic, confident, concise"
            value={form.personality}
            onChange={(e) => setField("personality", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Label>
              System Prompt{" "}
              <FieldTooltip text="Instructions the AI follows throughout the call. Use [variable_name] placeholders for dynamic values like contact name or company. More detail = better performance." />
            </Label>
            <span className="text-xs text-[#6b6b6b]">~{tokenCount} tokens</span>
          </div>
          <Textarea
            rows={8}
            placeholder="You are a friendly sales representative for Acme Inc. Your goal is to..."
            value={form.system_prompt}
            onChange={(e) => setField("system_prompt", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            First Message{" "}
            <FieldTooltip text="The exact words the agent says when the call is answered. Keep it short and natural. Use [name] to personalize with the contact's name." />
          </Label>
          <Textarea
            rows={3}
            placeholder="Hello! I'm calling from Acme Inc. Is this a good time to talk?"
            value={form.first_message}
            onChange={(e) => setField("first_message", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            Voicemail Message{" "}
            <FieldTooltip text="Spoken when the call goes to voicemail. Keep it under 30 seconds. Include a callback number or clear next step." />
          </Label>
          <Textarea
            rows={3}
            placeholder="Hi, I'm calling from Acme Inc. Please call us back at..."
            value={form.voicemail_message}
            onChange={(e) => setField("voicemail_message", e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
