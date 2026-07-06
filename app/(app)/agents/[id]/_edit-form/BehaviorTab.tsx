"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@/components/ui/tabs";
import type { AgentForm, SetAgentField } from "./constants";

export function BehaviorTab({
  form,
  setField,
}: {
  form: AgentForm;
  setField: SetAgentField;
}) {
  return (
    <TabsContent value="behavior" className="space-y-4 pt-4">
      <Card>
        <CardHeader>
          <CardTitle>Prompt & Behavior</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Objective</Label>
            <Input
              value={form.objective ?? ""}
              onChange={(e) => setField("objective", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>System Prompt</Label>
            <Textarea
              rows={8}
              value={form.system_prompt ?? ""}
              onChange={(e) => setField("system_prompt", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>First Message</Label>
            <Textarea
              rows={3}
              value={form.first_message ?? ""}
              onChange={(e) => setField("first_message", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Voicemail Message</Label>
            <Textarea
              rows={3}
              value={form.voicemail_message ?? ""}
              onChange={(e) => setField("voicemail_message", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
