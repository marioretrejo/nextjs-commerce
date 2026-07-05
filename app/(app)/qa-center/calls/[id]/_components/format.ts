/** Pure formatting/scoring helpers for the call-review page. */
import type { QACDiarizedTranscriptSegment } from "./types";

export function scoreColor(
  score: number,
): "green" | "yellow" | "orange" | "red" {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  if (score >= 40) return "orange";
  return "red";
}

export function riskColor(
  score: number,
): "green" | "yellow" | "orange" | "red" {
  if (score < 20) return "green";
  if (score < 45) return "yellow";
  if (score < 70) return "orange";
  return "red";
}

export function riskLabel(score: number): string {
  if (score < 20) return "Low Risk";
  if (score < 45) return "Medium Risk";
  if (score < 70) return "High Risk";
  return "Critical Risk";
}

export function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

// ─── Audio Player ─────────────────────────────────────────────────────────────

export function parseDiarizedSegments(
  raw: unknown,
): QACDiarizedTranscriptSegment[] | null {
  const obj = raw as Record<string, unknown>;
  const utterances = Array.isArray(raw)
    ? (raw as QACDiarizedTranscriptSegment[])
    : raw && typeof raw === "object" && Array.isArray(obj["utterances"])
      ? (obj["utterances"] as QACDiarizedTranscriptSegment[])
      : null;
  return utterances && utterances.length > 0 ? utterances : null;
}

const SPEAKER_COLORS: Array<{ pill: string; bar: string }> = [
  { pill: "bg-blue-100 text-blue-700 border-blue-200", bar: "bg-blue-300" },
  {
    pill: "bg-purple-100 text-purple-700 border-purple-200",
    bar: "bg-purple-300",
  },
  {
    pill: "bg-emerald-100 text-emerald-700 border-emerald-200",
    bar: "bg-emerald-300",
  },
  {
    pill: "bg-amber-100 text-amber-700 border-amber-200",
    bar: "bg-amber-300",
  },
];

export function formatTimestamp(ms?: number | null): string {
  if (ms == null) return "";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function resolveSpeakerLabel(sp?: string | null): string {
  if (!sp || sp === "unknown") return "Unknown";
  if (/^\d+$/.test(sp)) return `Speaker ${parseInt(sp, 10) + 1}`;
  if (sp.startsWith("speaker_"))
    return `Speaker ${parseInt(sp.replace("speaker_", ""), 10) + 1}`;
  return sp;
}
