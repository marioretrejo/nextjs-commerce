export const ALL_EVENTS = [
  {
    value: "call.completed",
    label: "Call Completed",
    description:
      "Fires when a call ends — includes transcript, recording URL, and analysis",
  },
  {
    value: "call.started",
    label: "Call Started",
    description: "Fires when a new room is created",
  },
  {
    value: "call.failed",
    label: "Call Failed",
    description: "Fires when Twilio reports a failure or no-answer",
  },
  {
    value: "campaign.run_complete",
    label: "Campaign Completed",
    description: "Fires when a batch campaign finishes all dials",
  },
];

export interface Endpoint {
  id: string;
  url: string;
  events: string[];
  description: string | null;
  is_active: boolean;
  last_delivery_at: string | null;
  last_delivery_status: string | null;
  last_delivery_status_code: number | null;
  created_at: string;
}
