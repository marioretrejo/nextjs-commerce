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
import { DAYS } from "../_components/constants";
import type { useCompliance } from "../_components/useCompliance";

export function PanelHoursTab({ c }: { c: ReturnType<typeof useCompliance> }) {
  const { settings, setSettings } = c;
  return (
    <TabsContent value="hours" className="pt-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Global Calling Hours</CardTitle>
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
              <p className="text-xs text-[#9b9b9b]">
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
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => c.toggleDay(d.id)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${(settings.calling_days ?? []).includes(d.id) ? "border-[#0a0a0a] bg-[#0a0a0a] text-white" : "border-[#e0e0e0] text-[#0a0a0a] hover:border-[#0a0a0a]"}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <Button
            onClick={c.saveSettings}
            disabled={c.savingSettings}
            size="sm"
          >
            {c.savingSettings ? "Saving…" : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
