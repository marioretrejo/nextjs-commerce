/** Constants + shared types for the agent edit form. */

import type { Agent } from "@/lib/supabase/types";

export const TRIGGER_LABELS: Record<string, string> = {
  any: "Any outcome",
  converted: "Converted",
  no_answer: "No answer",
  voicemail: "Voicemail",
  rejected: "Rejected",
  transferred: "Transferred",
};

export const ACTION_LABELS: Record<string, string> = {
  webhook: "Send Webhook",
  tag_contact: "Tag Contact",
  send_sms: "Send SMS",
  notify_team: "Notify Team",
  add_to_campaign: "Add to Campaign",
};

export const ACTION_COLORS: Record<string, string> = {
  webhook: "bg-purple-100 text-purple-700",
  tag_contact: "bg-blue-100 text-blue-700",
  send_sms: "bg-green-100 text-green-700",
  notify_team: "bg-orange-100 text-orange-700",
  add_to_campaign: "bg-pink-100 text-pink-700",
};

export interface PhoneNumber {
  id: string;
  number: string;
  status: string;
}

export type AgentForm = Partial<Agent>;
export type SetAgentField = <K extends keyof Agent>(
  key: K,
  val: Agent[K],
) => void;
