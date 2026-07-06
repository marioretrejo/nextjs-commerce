import { TrendingDown, TrendingUp } from "lucide-react";

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDuration(s: number | null) {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function riskBadgeVariant(
  r: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (!r) return "outline";
  if (r === "critical" || r === "high") return "destructive";
  if (r === "medium") return "secondary";
  return "outline";
}

export function sentimentColor(s: string | null) {
  if (!s) return "text-gray-500";
  const l = s.toLowerCase();
  if (l === "positive") return "text-green-400";
  if (l === "negative") return "text-red-400";
  return "text-yellow-400";
}

export function healthColor(score: number) {
  if (score >= 70) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

export function riskColor(r: string) {
  if (r === "low") return "text-green-400";
  if (r === "medium") return "text-yellow-400";
  if (r === "high") return "text-orange-400";
  return "text-red-400";
}

export function trendIcon(t: string) {
  if (t === "improving")
    return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
  if (t === "declining")
    return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return null;
}

export function trendColor(t: string) {
  if (t === "improving") return "text-green-400";
  if (t === "declining") return "text-red-400";
  return "text-gray-400";
}
