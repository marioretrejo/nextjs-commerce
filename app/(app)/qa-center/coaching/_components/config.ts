export interface CoachingReport {
  id: string;
  agent_id: string | null;
  interaction_id: string | null;
  priority_score: number;
  strengths: string[] | null;
  weaknesses: string[] | null;
  recommended_training: string[] | null;
  coaching_plan: string | null;
  created_at: string;
  qac_interactions: {
    agent_name: string | null;
    channel: string;
    risk_level: string | null;
    created_at: string;
  } | null;
}

export interface CoachingResponse {
  data: CoachingReport[];
  total: number;
  page: number;
  pages: number;
}

export const PRIORITY_COLOR: Record<string, string> = {
  urgent: "text-red-400 bg-red-400/10 border-red-400/20",
  high: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  medium: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  low: "text-gray-400 bg-gray-700/50 border-gray-700",
};

export const RISK_COLOR: Record<string, string> = {
  high: "text-red-400 bg-red-400/10",
  medium: "text-amber-400 bg-amber-400/10",
  low: "text-emerald-400 bg-emerald-400/10",
};

export function priorityLabel(score: number): string {
  if (score >= 80) return "urgent";
  if (score >= 65) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtRelative(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 30 ? `${days}d ago` : fmtDate(d);
}
