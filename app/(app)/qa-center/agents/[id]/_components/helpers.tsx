import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { hasChartData } from "@/lib/chart-utils";

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

export const PRIORITY_COLOR: Record<string, string> = {
  urgent: "text-red-400 bg-red-400/10",
  high: "text-amber-400 bg-amber-400/10",
  medium: "text-blue-400 bg-blue-400/10",
  low: "text-gray-400 bg-gray-700/50",
};

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

export function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up")
    return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (trend === "down")
    return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-gray-500" />;
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

/* ─── Mini sparkline (SVG) ───────────────────────────────────────── */
export function Sparkline({
  data,
}: {
  data: Array<{ date: string; score: number }>;
}) {
  // Guard: empty or all-zero series must not render as a flat/solid line.
  if (
    data.length < 2 ||
    !hasChartData(data, (d) => (d as { score: number }).score)
  ) {
    return <EmptyState compact title="Sin actividad aún" />;
  }
  const W = 120,
    H = 36,
    PAD = 4;
  const scores = data.map((d) => d.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const pts = data
    .map((d, i) => {
      const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
      const y = H - PAD - ((d.score - min) / range) * (H - PAD * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const last = scores[scores.length - 1]!;
  const first = scores[0]!;
  const stroke = last >= first ? "#34d399" : "#f87171";
  return (
    <svg width={W} height={H} className="inline-block align-middle">
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
