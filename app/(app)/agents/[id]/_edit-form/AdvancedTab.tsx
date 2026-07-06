"use client";

import { useState, useEffect, useRef } from "react";

import { Play, Plus, Square, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@/components/ui/tabs";
import type { Agent } from "@/lib/supabase/types";
import type { AgentForm, SetAgentField, PhoneNumber } from "./constants";

export function AdvancedTab({
  form,
  setField,
  agent,
  phoneNumbers,
  dynVars,
  updateDynVars,
}: {
  form: AgentForm;
  setField: SetAgentField;
  agent: Agent;
  phoneNumbers: PhoneNumber[];
  dynVars: { key: string; value: string }[];
  updateDynVars: (entries: { key: string; value: string }[]) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingAmbient, setPlayingAmbient] = useState(false);

  useEffect(() => {
    audioRef.current?.pause();
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingAmbient(false);
  }, [form.ambient_sound]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  function toggleAmbientPreview() {
    if (playingAmbient) {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      setPlayingAmbient(false);
      return;
    }
    if (!form.ambient_sound) return;
    const audio = new Audio(`/soundscapes/${form.ambient_sound}.wav`);
    audio.volume = Math.min(1, form.ambient_sound_volume ?? 1.0);
    audio.loop = true;
    audio.onerror = () => {
      setPlayingAmbient(false);
    };
    audioRef.current = audio;
    audio
      .play()
      .then(() => setPlayingAmbient(true))
      .catch(() => setPlayingAmbient(false));
  }

  return (
    <TabsContent value="advanced" className="space-y-4 pt-4">
      <Card>
        <CardHeader>
          <CardTitle>Advanced</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Phone Number</Label>
            <Select
              value={form.phone_number_id ?? "none"}
              onValueChange={(v) =>
                setField("phone_number_id", v === "none" ? null : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select phone number" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {phoneNumbers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {[
            {
              key: "interruption_handling" as const,
              label: "Interruption Handling",
            },
            {
              key: "noise_cancellation" as const,
              label: "Noise Cancellation",
            },
            {
              key: "post_call_analysis_enabled" as const,
              label: "Post-Call Analysis",
            },
            { key: "transfer_enabled" as const, label: "Call Transfer" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <Switch
                checked={!!form[key]}
                onCheckedChange={(v) => setField(key, v as Agent[typeof key])}
              />
              <Label>{label}</Label>
            </div>
          ))}

          {/* Core Engine timing */}
          <div className="space-y-3 rounded-lg border border-[#e0e0e0] p-4">
            <div>
              <Label className="text-sm font-medium">
                Core Engine Settings
              </Label>
              <p className="text-xs text-[#6b6b6b] mt-0.5">
                Control response timing and call initiation behavior.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Response Delay (ms)</Label>
                <Input
                  type="number"
                  min={0}
                  max={3000}
                  step={100}
                  value={form.response_delay_ms ?? 500}
                  onChange={(e) =>
                    setField("response_delay_ms", parseInt(e.target.value) || 0)
                  }
                />
                <p className="text-[10px] text-[#6b6b6b]">
                  Pause before agent speaks after caller stops (0–3000 ms).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Speak First</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch
                    checked={!!form.speak_first}
                    onCheckedChange={(v) => setField("speak_first", v)}
                  />
                  <span className="text-xs text-[#6b6b6b]">
                    {form.speak_first
                      ? "Agent speaks first"
                      : "Wait for caller"}
                  </span>
                </div>
                <p className="text-[10px] text-[#6b6b6b]">
                  Agent delivers greeting immediately on connect without
                  waiting.
                </p>
              </div>
            </div>
          </div>

          {/* AMD — Answer Machine Detection */}
          <div className="space-y-3 rounded-lg border border-[#e0e0e0] p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">
                  Answer Machine Detection (AMD)
                </Label>
                <p className="text-xs text-[#6b6b6b] mt-0.5">
                  Automatically detect voicemail and take action instead of
                  speaking to the machine.
                </p>
              </div>
              <Switch
                checked={!!form.amd_enabled}
                onCheckedChange={(v) => setField("amd_enabled", v)}
              />
            </div>
            {form.amd_enabled && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <Label>When voicemail is detected</Label>
                  <Select
                    value={form.amd_action ?? "hangup"}
                    onValueChange={(v) =>
                      setField("amd_action", v as Agent["amd_action"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hangup">
                        Hang up immediately
                      </SelectItem>
                      <SelectItem value="leave_voicemail">
                        Leave a voicemail message
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.amd_action !== "hangup" && (
                  <div className="space-y-1.5">
                    <Label>Voicemail Message</Label>
                    <Textarea
                      rows={3}
                      placeholder="Hi, this is [Agent Name]. We tried to reach you today. We'll try again later. Thank you!"
                      value={form.voicemail_message ?? ""}
                      onChange={(e) =>
                        setField("voicemail_message", e.target.value)
                      }
                    />
                    <p className="text-xs text-[#6b6b6b]">
                      This message will be spoken when a voicemail is detected.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Background Soundscape */}
          <div className="space-y-3 rounded-lg border border-[#e0e0e0] p-4">
            <div>
              <Label className="text-sm font-medium">
                Background Soundscape
              </Label>
              <p className="text-xs text-[#6b6b6b] mt-0.5">
                Add ambient background sound to make the agent feel more natural
                during calls.
              </p>
            </div>
            <div className="flex gap-2">
              <Select
                value={form.ambient_sound ?? "none"}
                onValueChange={(v) =>
                  setField(
                    "ambient_sound",
                    v === "none" ? null : (v as Agent["ambient_sound"]),
                  )
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (silent)</SelectItem>
                  <SelectItem value="coffee-shop">Coffee Shop</SelectItem>
                  <SelectItem value="convention-hall">
                    Convention Hall
                  </SelectItem>
                  <SelectItem value="summer-outdoor">Summer Outdoor</SelectItem>
                  <SelectItem value="mountain-outdoor">
                    Mountain Outdoor
                  </SelectItem>
                  <SelectItem value="static-noise">Static Noise</SelectItem>
                  <SelectItem value="call-center">Call Center</SelectItem>
                </SelectContent>
              </Select>
              {form.ambient_sound && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={toggleAmbientPreview}
                  title={playingAmbient ? "Stop preview" : "Preview sound"}
                  className={
                    playingAmbient
                      ? "border-[#0a0a0a] bg-[#0a0a0a] text-white hover:bg-[#333]"
                      : ""
                  }
                >
                  {playingAmbient ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            {form.ambient_sound && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Volume</Label>
                  <span className="text-xs text-[#6b6b6b]">
                    {((form.ambient_sound_volume ?? 1.0) * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={form.ambient_sound_volume ?? 1.0}
                  onChange={(e) => {
                    const vol = parseFloat(e.target.value);
                    setField("ambient_sound_volume", vol);
                    if (audioRef.current)
                      audioRef.current.volume = Math.min(1, vol);
                  }}
                  className="w-full accent-[#0a0a0a]"
                />
                <div className="flex justify-between text-[10px] text-[#6b6b6b]">
                  <span>Quiet</span>
                  <span>Normal</span>
                  <span>Loud</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <Label>Dynamic Variables</Label>
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
            <p className="text-xs text-[#6b6b6b]">
              Variables injected into the agent's prompts at call time.
            </p>
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
    </TabsContent>
  );
}
