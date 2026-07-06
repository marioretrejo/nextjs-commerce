import type { Dispatch, SetStateAction } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldTooltip } from "@/components/ui/field-tooltip";
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
import type { Agent, CampaignForm } from "./types";

export function StepInfo({
  form,
  setForm,
  agents,
}: {
  form: CampaignForm;
  setForm: Dispatch<SetStateAction<CampaignForm>>;
  agents: Agent[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Campaign Name *</Label>
          <Input
            placeholder="Q2 Outreach, Product Demo Invites…"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea
            placeholder="What is this campaign about?"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Agent *</Label>
          <Select
            value={form.agent_id}
            onValueChange={(v) => setForm((f) => ({ ...f, agent_id: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>
              Max Concurrent Calls{" "}
              <FieldTooltip text="How many simultaneous calls the campaign can place. Higher concurrency finishes faster but requires more phone lines. Start with 5 and scale up." />
            </Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={form.max_concurrency}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  max_concurrency: Number(e.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Retry Interval (hours){" "}
              <FieldTooltip text="How long to wait before retrying a contact who didn't answer. 24 hours is recommended to avoid appearing as spam." />
            </Label>
            <Input
              type="number"
              min={1}
              value={form.retry_interval_hours}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  retry_interval_hours: Number(e.target.value),
                }))
              }
              disabled={!form.retry_enabled}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={form.retry_enabled}
            onCheckedChange={(v) =>
              setForm((f) => ({ ...f, retry_enabled: v }))
            }
          />
          <Label>Enable Auto-Retry</Label>
        </div>
        {form.retry_enabled && (
          <div className="space-y-1.5">
            <Label>
              Max Retries per Contact{" "}
              <FieldTooltip text="Maximum number of retry attempts per contact. After this many no-answer calls, the contact is marked as 'max_attempts' and skipped." />
            </Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={form.max_retries}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  max_retries: Number(e.target.value),
                }))
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
