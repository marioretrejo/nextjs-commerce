import type { Dispatch, SetStateAction } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Agent, CampaignForm } from "./types";

export function StepAbTest({
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
        <CardTitle>A/B Test (Optional)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-3">
          <Switch
            checked={form.ab_enabled}
            onCheckedChange={(v) => setForm((f) => ({ ...f, ab_enabled: v }))}
          />
          <div>
            <Label>
              Enable A/B Test{" "}
              <FieldTooltip text="Randomly splits your contact list between Agent A and Agent B. After the campaign, compare conversion rates to find the better-performing agent." />
            </Label>
            <p className="text-xs text-[#6b6b6b]">
              Split contacts between two agents to compare performance
            </p>
          </div>
        </div>

        {form.ab_enabled && (
          <>
            <div className="space-y-1.5">
              <Label>Agent B</Label>
              <Select
                value={form.ab_agent_id}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, ab_agent_id: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Agent B" />
                </SelectTrigger>
                <SelectContent>
                  {agents
                    .filter((a) => a.id !== form.agent_id)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-[#6b6b6b]">
                Agent A is already selected in step 1.
              </p>
            </div>

            <div className="space-y-2">
              <Label>
                Split Ratio{" "}
                <FieldTooltip text="The percentage of contacts assigned to each agent. 50/50 gives the most statistically reliable comparison. Bias towards a known-good agent if you want lower risk." />{" "}
                — Agent A: {form.ab_split_ratio}% / Agent B:{" "}
                {100 - form.ab_split_ratio}%
              </Label>
              <input
                type="range"
                min={10}
                max={90}
                step={10}
                value={form.ab_split_ratio}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    ab_split_ratio: Number(e.target.value),
                  }))
                }
                className="w-full accent-[#0a0a0a]"
              />
              <div className="flex justify-between text-xs text-[#6b6b6b]">
                <span>
                  Agent A:{" "}
                  {agents.find((a) => a.id === form.agent_id)?.name ?? "—"}
                </span>
                <span>
                  Agent B:{" "}
                  {agents.find((a) => a.id === form.ab_agent_id)?.name ?? "—"}
                </span>
              </div>
            </div>
          </>
        )}

        {!form.ab_enabled && (
          <div className="rounded-lg bg-[#f5f5f5] p-4 text-sm text-[#6b6b6b]">
            Skip this step to run the campaign with a single agent. Enable A/B
            testing to compare two agents head-to-head.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
