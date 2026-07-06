import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Agent, CampaignForm, Contact } from "./types";

export function StepReview({
  form,
  agents,
  contacts,
}: {
  form: CampaignForm;
  agents: Agent[];
  contacts: Contact[];
}) {
  const rows = [
    { label: "Campaign Name", value: form.name },
    {
      label: "Agent A",
      value: agents.find((a) => a.id === form.agent_id)?.name ?? "—",
    },
    ...(form.ab_enabled
      ? [
          {
            label: "Agent B",
            value: agents.find((a) => a.id === form.ab_agent_id)?.name ?? "—",
          },
          {
            label: "A/B Split",
            value: `${form.ab_split_ratio}% / ${100 - form.ab_split_ratio}%`,
          },
        ]
      : []),
    { label: "Contacts", value: `${contacts.length} contacts` },
    {
      label: "Concurrency",
      value: `${form.max_concurrency} simultaneous calls`,
    },
    {
      label: "Retry",
      value: form.retry_enabled
        ? `Yes, every ${form.retry_interval_hours}h · max ${form.max_retries}× per contact`
        : "No",
    },
    { label: "Timezone", value: form.timezone },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review & Launch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-[#e0e0e0] divide-y divide-[#e0e0e0]">
          {rows.map(({ label, value }) => (
            <div
              key={label}
              className="flex justify-between px-4 py-2.5 text-sm"
            >
              <span className="text-[#6b6b6b]">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#6b6b6b]">
          The campaign will be saved as draft. Launch it from the campaign
          detail page when ready.
        </p>
      </CardContent>
    </Card>
  );
}
