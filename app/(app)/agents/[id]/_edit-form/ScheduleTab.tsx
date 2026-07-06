"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import type { AgentForm, SetAgentField } from "./constants";

export function ScheduleTab({
  form,
  setField,
}: {
  form: AgentForm;
  setField: SetAgentField;
}) {
  return (
    <TabsContent value="schedule" className="space-y-4 pt-4">
      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Start Time</Label>
              <Input
                type="time"
                value={form.schedule_start_time ?? "09:00"}
                onChange={(e) =>
                  setField("schedule_start_time", e.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>End Time</Label>
              <Input
                type="time"
                value={form.schedule_end_time ?? "18:00"}
                onChange={(e) => setField("schedule_end_time", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Max Attempts</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={form.max_attempts ?? 3}
                onChange={(e) =>
                  setField("max_attempts", Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Retry (min)</Label>
              <Input
                type="number"
                min={15}
                value={form.retry_interval_minutes ?? 60}
                onChange={(e) =>
                  setField("retry_interval_minutes", Number(e.target.value))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
