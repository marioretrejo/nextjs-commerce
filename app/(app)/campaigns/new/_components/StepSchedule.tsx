import type { Dispatch, SetStateAction } from "react";
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
import type { CampaignForm } from "./types";

export function StepSchedule({
  form,
  setForm,
}: {
  form: CampaignForm;
  setForm: Dispatch<SetStateAction<CampaignForm>>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Start Date/Time</Label>
            <Input
              type="datetime-local"
              value={form.start_at}
              onChange={(e) =>
                setForm((f) => ({ ...f, start_at: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>End Date/Time</Label>
            <Input
              type="datetime-local"
              value={form.end_at}
              onChange={(e) =>
                setForm((f) => ({ ...f, end_at: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Timezone</Label>
          <Select
            value={form.timezone}
            onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "America/New_York",
                "America/Chicago",
                "America/Los_Angeles",
                "America/Bogota",
                "Europe/London",
                "Europe/Madrid",
              ].map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={form.respect_schedule}
            onCheckedChange={(v) =>
              setForm((f) => ({ ...f, respect_schedule: v }))
            }
          />
          <div>
            <Label>Respect Agent Schedule</Label>
            <p className="text-xs text-[#6b6b6b]">
              Only call during the agent's configured hours
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
