import type { Dispatch, SetStateAction } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import type { ComplianceSettings } from "@/lib/supabase/types";
import { DAYS } from "./constants";

export function CallingHoursTab({
  settings,
  setSettings,
  savingSettings,
  onSave,
}: {
  settings: Partial<ComplianceSettings>;
  setSettings: Dispatch<SetStateAction<Partial<ComplianceSettings>>>;
  savingSettings: boolean;
  onSave: () => void;
}) {
  function toggleDay(day: string) {
    const days = settings.calling_days ?? [];
    setSettings((s) => ({
      ...s,
      calling_days: days.includes(day)
        ? days.filter((d) => d !== day)
        : [...days, day],
    }));
  }

  return (
    <TabsContent value="hours" className="space-y-4 pt-4">
      <Card>
        <CardHeader>
          <CardTitle>Global Calling Hours</CardTitle>
          <CardDescription>
            Override all agents with workspace-wide calling restrictions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <Switch
              checked={!!settings.calling_hours_enabled}
              onCheckedChange={(v) =>
                setSettings((s) => ({ ...s, calling_hours_enabled: v }))
              }
            />
            <div>
              <Label>Enable Global Calling Hours</Label>
              <p className="text-xs text-[#6b6b6b]">
                Restricts all outbound calls to the time window below
              </p>
            </div>
          </div>

          {settings.calling_hours_enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={settings.calling_hours_start ?? "09:00"}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        calling_hours_start: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={settings.calling_hours_end ?? "20:00"}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        calling_hours_end: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Allowed Days</Label>
                <div className="flex gap-2">
                  {DAYS.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => toggleDay(d.id)}
                      className={[
                        "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                        (settings.calling_days ?? []).includes(d.id)
                          ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                          : "border-[#e0e0e0] text-[#0a0a0a] hover:border-[#0a0a0a]",
                      ].join(" ")}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <Button onClick={onSave} disabled={savingSettings}>
            {savingSettings ? "Saving…" : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
