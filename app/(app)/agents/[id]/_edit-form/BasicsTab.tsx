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
import { TabsContent } from "@/components/ui/tabs";
import type { Agent } from "@/lib/supabase/types";
import type { AgentForm, SetAgentField } from "./constants";

export function BasicsTab({
  form,
  setField,
  agent,
}: {
  form: AgentForm;
  setField: SetAgentField;
  agent: Agent;
}) {
  return (
    <TabsContent value="basics" className="space-y-4 pt-4">
      <Card>
        <CardHeader>
          <CardTitle>Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={form.name ?? ""}
              onChange={(e) => setField("name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Voice</Label>
            <div className="flex items-center gap-2 rounded-md border border-[#e0e0e0] bg-[#f5f5f5] px-3 py-2">
              <span className="text-sm font-medium flex-1">
                {form.voice_name ??
                  (form.voice_id ? "Custom voice" : "No voice selected")}
              </span>
              {form.voice_id && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                  AI Voice
                </span>
              )}
            </div>
            <p className="text-xs text-[#6b6b6b]">
              To change voice, create a new agent or contact support.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Voice Emotion</Label>
            <Select
              value={form.voice_emotion ?? "none"}
              onValueChange={(v) =>
                setField(
                  "voice_emotion",
                  v === "none" ? null : (v as Agent["voice_emotion"]),
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (neutral)</SelectItem>
                <SelectItem value="calm">😌 Calm</SelectItem>
                <SelectItem value="sympathetic">🤝 Sympathetic</SelectItem>
                <SelectItem value="happy">😊 Happy</SelectItem>
                <SelectItem value="sad">😢 Sad</SelectItem>
                <SelectItem value="angry">😠 Angry</SelectItem>
                <SelectItem value="fearful">😨 Fearful</SelectItem>
                <SelectItem value="surprised">😲 Surprised</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.status ?? "active"}
              onValueChange={(v) => setField("status", v as Agent["status"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
