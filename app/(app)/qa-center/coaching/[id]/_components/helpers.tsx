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

export const REVIEW_COLOR: Record<string, string> = {
  pending_review: "text-gray-400 bg-gray-700/50",
  in_review: "text-blue-400 bg-blue-400/10",
  reviewed: "text-indigo-400 bg-indigo-400/10",
  approved: "text-emerald-400 bg-emerald-400/10",
  disputed: "text-red-400 bg-red-400/10",
};

export function priorityLabel(score: number): string {
  if (score >= 80) return "urgent";
  if (score >= 65) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export function fmtDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 80
      ? "text-emerald-400 bg-emerald-400/10"
      : score >= 65
        ? "text-amber-400 bg-amber-400/10"
        : "text-red-400 bg-red-400/10";
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {score.toFixed(0)}
    </span>
  );
}
