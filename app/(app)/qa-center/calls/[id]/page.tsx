"use client";

import { useState, useEffect, useCallback, use, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Globe,
  Loader2,
  MessageSquare,
  Pause,
  Phone,
  Play,
  PlayCircle,
  Shield,
  ShieldAlert,
  TrendingUp,
  User,
  Volume2,
  VolumeX,
  XCircle,
  Zap,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QACFlag {
  id: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  label: string;
  transcript_fragment?: string | null;
  regulation?: string | null;
  coaching_note?: string | null;
  timestamp_s?: number | null;
  suggested_correction?: string | null;
  violation_type?: string | null;
}

interface CriteriaScores {
  opening: number;
  compliance: number;
  objection_handling: number;
  closing: number;
  empathy: number;
}

interface KeyMoment {
  timestamp_pct?: number;
  timestamp_s?: number;
  type: string;
  description: string;
}

interface SentimentPoint {
  position: number;
  sentiment: "positive" | "neutral" | "negative";
  label?: string;
}

interface CoachingInsights {
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  recommended_training?: string[];
  coaching_plan?: string;
}

interface QACEvaluation {
  id: string;
  overall_score: number;
  risk_score: number;
  tone: string;
  summary: string;
  criteria_scores: CriteriaScores;
  rules_applied: number;
  evaluated_at: string;
  key_moments?: KeyMoment[];
  sentiment_timeline?: SentimentPoint[];
  coaching_insights?: CoachingInsights;
  qac_flags: QACFlag[];
}

interface QACInteraction {
  id: string;
  agent_name: string;
  agent_id: string | null;
  channel: string;
  direction?: string | null;
  duration_s: number | null;
  status: "pending" | "analyzing" | "analyzed" | "failed";
  created_at: string;
  language?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  campaign?: string | null;
  transcript?: string | null;
  diarized_transcript?: unknown;
  audio_url?: string | null;
  metadata?: Record<string, unknown>;
  review_status: string;
  reviewer_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  qac_evaluations: QACEvaluation[];
}

interface ComplianceViolation {
  id: string;
  severity: "critical" | "warning";
  rule_name: string;
  fragment: string | null;
  confidence: number | null;
  is_false_positive: boolean;
  created_at: string;
}

interface QACComment {
  id: string;
  comment: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface QACAuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  analyze: "Analysis run",
  "review_status.change": "Review status changed",
  "comment.create": "Comment added",
  "interaction.create": "Interaction created",
  "interaction.delete": "Interaction deleted",
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SEV_CFG: Record<
  string,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  low: {
    bg: "bg-gray-50",
    text: "text-gray-700",
    border: "border-gray-200",
    dot: "bg-gray-400",
    label: "Low",
  },
  medium: {
    bg: "bg-yellow-50",
    text: "text-yellow-800",
    border: "border-yellow-200",
    dot: "bg-yellow-500",
    label: "Medium",
  },
  high: {
    bg: "bg-orange-50",
    text: "text-orange-800",
    border: "border-orange-200",
    dot: "bg-orange-500",
    label: "High",
  },
  critical: {
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border-red-200",
    dot: "bg-red-500",
    label: "Critical",
  },
};

const CAT_CFG: Record<string, string> = {
  compliance: "bg-red-50 text-red-700 border-red-100",
  quality: "bg-blue-50 text-blue-700 border-blue-100",
  disclosure: "bg-purple-50 text-purple-700 border-purple-100",
  prohibited: "bg-gray-900 text-white border-transparent",
  coaching: "bg-green-50 text-green-700 border-green-100",
};

const GAUGE_COLORS: Record<string, { stroke: string; text: string }> = {
  green: { stroke: "#16a34a", text: "text-green-600" },
  yellow: { stroke: "#ca8a04", text: "text-yellow-600" },
  orange: { stroke: "#ea580c", text: "text-orange-600" },
  red: { stroke: "#dc2626", text: "text-red-600" },
};

function scoreColor(score: number): "green" | "yellow" | "orange" | "red" {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  if (score >= 40) return "orange";
  return "red";
}

function riskColor(score: number): "green" | "yellow" | "orange" | "red" {
  if (score < 20) return "green";
  if (score < 45) return "yellow";
  if (score < 70) return "orange";
  return "red";
}

function riskLabel(score: number): string {
  if (score < 20) return "Low Risk";
  if (score < 45) return "Medium Risk";
  if (score < 70) return "High Risk";
  return "Critical Risk";
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

// ─── Audio Player ─────────────────────────────────────────────────────────────

function AudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      void el.play();
    }
    setPlaying(!playing);
  }

  function onTimeUpdate() {
    setCurrent(audioRef.current?.currentTime ?? 0);
  }

  function onLoadedMetadata() {
    setDuration(audioRef.current?.duration ?? 0);
    setLoading(false);
  }

  function onEnded() {
    setPlaying(false);
    setCurrent(0);
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const t = Number(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrent(t);
  }

  function toggleMute() {
    if (audioRef.current) audioRef.current.muted = !muted;
    setMuted((m) => !m);
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${sec}`;
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="rounded-xl border border-[#efefef] bg-[#fafafa] px-4 py-3">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        preload="metadata"
      />
      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <button
          onClick={toggle}
          disabled={loading}
          className="h-8 w-8 rounded-full bg-[#111] flex items-center justify-center shrink-0 hover:bg-[#333] transition-colors disabled:opacity-40"
        >
          {playing ? (
            <Pause className="h-3.5 w-3.5 text-white" />
          ) : (
            <Play className="h-3.5 w-3.5 text-white ml-0.5" />
          )}
        </button>

        {/* Time / Seek */}
        <div className="flex-1 space-y-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={current}
            onChange={seek}
            className="w-full h-1 appearance-none bg-[#e0e0e0] rounded-full cursor-pointer accent-[#111]"
            style={{
              background: `linear-gradient(to right, #111 ${pct}%, #e0e0e0 ${pct}%)`,
            }}
          />
          <div className="flex justify-between text-[10px] text-[#9b9b9b]">
            <span>{fmt(current)}</span>
            <span>{loading ? "…" : fmt(duration)}</span>
          </div>
        </div>

        {/* Mute */}
        <button
          onClick={toggleMute}
          className="text-[#9b9b9b] hover:text-[#111] transition-colors"
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>

        {/* Download */}
        <a
          href={url}
          download
          className="flex items-center gap-1 text-[10px] font-medium text-[#9b9b9b] hover:text-[#111] transition-colors border border-[#e0e0e0] rounded-lg px-2 py-1 hover:border-[#111]"
        >
          <Download className="h-3 w-3" />
          Download
        </a>
      </div>
    </div>
  );
}

// ─── Circular Score Gauge ─────────────────────────────────────────────────────

function ScoreGauge({
  score,
  label,
  size = 88,
}: {
  score: number;
  label: string;
  size?: number;
}) {
  const colorKey = scoreColor(score);
  const cfg = GAUGE_COLORS[colorKey]!;
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const cx = size / 2;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="#f0f0f0"
          strokeWidth={8}
        />
        {/* Fill */}
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={cfg.stroke}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="text-center -mt-[72px] mb-1" style={{ width: size }}>
        <span className={`text-xl font-bold leading-none ${cfg.text}`}>
          {score}
        </span>
      </div>
      <div className="text-center mt-[56px]">
        <p className="text-[11px] font-medium text-[#6b6b6b] leading-tight">
          {label}
        </p>
      </div>
    </div>
  );
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────

function RiskBadge({ score }: { score: number }) {
  const c = riskColor(score);
  const styles: Record<string, string> = {
    green: "bg-green-50 text-green-700 border-green-200",
    yellow: "bg-yellow-50 text-yellow-800 border-yellow-200",
    orange: "bg-orange-50 text-orange-800 border-orange-200",
    red: "bg-red-50 text-red-800 border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${styles[c]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          c === "green"
            ? "bg-green-500"
            : c === "yellow"
              ? "bg-yellow-500"
              : c === "orange"
                ? "bg-orange-500"
                : "bg-red-500"
        }`}
      />
      {riskLabel(score)} ({score})
    </span>
  );
}

// ─── Highlighted Transcript ───────────────────────────────────────────────────

function HighlightedTranscript({
  transcript,
  flags,
}: {
  transcript: string;
  flags: QACFlag[];
}) {
  const [activeFlag, setActiveFlag] = useState<string | null>(null);

  // Build a map of fragment → flag for highlighting
  const fragmentMap = new Map<string, QACFlag>();
  for (const flag of flags) {
    if (flag.transcript_fragment) {
      fragmentMap.set(flag.transcript_fragment.trim().slice(0, 60), flag);
    }
  }

  // Split transcript into highlighted segments
  type Segment = { text: string; flag: QACFlag | null };
  const segments: Segment[] = [];
  let remaining = transcript;

  const sortedFragments = Array.from(fragmentMap.entries()).sort(
    ([a], [b]) => transcript.indexOf(a) - transcript.indexOf(b),
  );

  for (const [fragment, flag] of sortedFragments) {
    const idx = remaining.indexOf(fragment);
    if (idx === -1) continue;
    if (idx > 0) segments.push({ text: remaining.slice(0, idx), flag: null });
    segments.push({ text: remaining.slice(idx, idx + fragment.length), flag });
    remaining = remaining.slice(idx + fragment.length);
  }

  if (remaining) segments.push({ text: remaining, flag: null });

  const finalSegments =
    segments.length > 0 ? segments : [{ text: transcript, flag: null }];

  return (
    <TooltipProvider delayDuration={0}>
      <div className="font-mono text-[13px] leading-relaxed text-[#333] whitespace-pre-wrap">
        {finalSegments.map((seg, i) => {
          if (!seg.flag) {
            return <span key={i}>{seg.text}</span>;
          }
          const sev = SEV_CFG[seg.flag.severity] ?? SEV_CFG["medium"]!;
          const isActive = activeFlag === seg.flag.id;
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <mark
                  className={`cursor-pointer rounded px-0.5 transition-colors ${
                    seg.flag.severity === "critical" ||
                    seg.flag.severity === "high"
                      ? "bg-red-200 hover:bg-red-300"
                      : "bg-yellow-200 hover:bg-yellow-300"
                  } ${isActive ? "ring-2 ring-offset-1 ring-orange-400" : ""}`}
                  onClick={() => setActiveFlag(isActive ? null : seg.flag!.id)}
                >
                  {seg.text}
                </mark>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${sev.dot}`} />
                  <span className="font-semibold text-[11px]">
                    {seg.flag.label}
                  </span>
                  <span
                    className={`text-[10px] capitalize px-1.5 py-0.5 rounded border ${CAT_CFG[seg.flag.category] ?? ""}`}
                  >
                    {seg.flag.category}
                  </span>
                </div>
                {seg.flag.regulation && (
                  <p className="text-[10px] font-mono text-[#555]">
                    {seg.flag.regulation}
                  </p>
                )}
                {seg.flag.coaching_note && (
                  <p className="text-[11px] text-[#444]">
                    {seg.flag.coaching_note}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// ─── Diarized Transcript ─────────────────────────────────────────────────────

interface QACDiarizedTranscriptSegment {
  speaker?: string | null;
  text?: string | null;
  start_ms?: number | null;
  end_ms?: number | null;
  confidence?: number | null;
}

function parseDiarizedSegments(
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

function formatTimestamp(ms?: number | null): string {
  if (ms == null) return "";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function resolveSpeakerLabel(sp?: string | null): string {
  if (!sp || sp === "unknown") return "Unknown";
  if (/^\d+$/.test(sp)) return `Speaker ${parseInt(sp, 10) + 1}`;
  if (sp.startsWith("speaker_"))
    return `Speaker ${parseInt(sp.replace("speaker_", ""), 10) + 1}`;
  return sp;
}

function DiarizedTranscriptView({
  segments,
}: {
  segments: QACDiarizedTranscriptSegment[];
}) {
  const speakerOrder: string[] = [];
  for (const seg of segments) {
    const sp = seg.speaker ?? "unknown";
    if (!speakerOrder.includes(sp)) speakerOrder.push(sp);
  }

  return (
    <div className="space-y-4">
      {segments.map((seg, i) => {
        const text = (seg.text ?? "").trim();
        if (!text) return null;
        const sp = seg.speaker ?? "unknown";
        const colorIdx = speakerOrder.indexOf(sp) % SPEAKER_COLORS.length;
        const color = SPEAKER_COLORS[colorIdx]!;
        const timeStart = formatTimestamp(seg.start_ms);
        const timeEnd = formatTimestamp(seg.end_ms);
        const timeLabel = timeStart
          ? timeEnd
            ? `${timeStart} – ${timeEnd}`
            : timeStart
          : null;

        return (
          <div key={i} className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-[88px] pt-0.5 text-right">
              <span
                className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color.pill}`}
              >
                {resolveSpeakerLabel(sp)}
              </span>
              {timeLabel && (
                <p className="text-[10px] text-[#b0b0b0] mt-0.5 tabular-nums">
                  {timeLabel}
                </p>
              )}
            </div>
            <div className={`flex-1 border-l-2 ${color.bar} pl-3 pb-0.5`}>
              <p className="text-[13px] leading-relaxed text-[#333]">{text}</p>
              {seg.confidence != null && (
                <p className="text-[10px] text-[#c0c0c0] mt-0.5 font-mono">
                  {Math.round(seg.confidence * 100)}%
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TranscriptCard({
  transcript,
  diarizedRaw,
  flags,
  criticalFlags,
  highFlags,
}: {
  transcript?: string | null;
  diarizedRaw?: unknown;
  flags: QACFlag[];
  criticalFlags: QACFlag[];
  highFlags: QACFlag[];
}) {
  const segments = parseDiarizedSegments(diarizedRaw);
  const [mode, setMode] = useState<"diarized" | "plain">(
    segments ? "diarized" : "plain",
  );

  return (
    <Card className="border-[#efefef]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#6b6b6b]" />
            Transcript
            {segments && (
              <span className="text-[10px] font-normal text-[#9b9b9b]">
                · diarized
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {segments && (
              <div className="flex items-center rounded-md border border-[#e8e8e8] overflow-hidden text-[11px]">
                <button
                  onClick={() => setMode("diarized")}
                  className={`px-2.5 py-1 transition-colors ${
                    mode === "diarized"
                      ? "bg-[#f5f5f5] text-[#111] font-semibold"
                      : "text-[#9b9b9b] hover:text-[#555]"
                  }`}
                >
                  By Speaker
                </button>
                <button
                  onClick={() => setMode("plain")}
                  className={`px-2.5 py-1 transition-colors border-l border-[#e8e8e8] ${
                    mode === "plain"
                      ? "bg-[#f5f5f5] text-[#111] font-semibold"
                      : "text-[#9b9b9b] hover:text-[#555]"
                  }`}
                >
                  Plain
                </button>
              </div>
            )}
            {criticalFlags.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {criticalFlags.length} Critical
              </span>
            )}
            {highFlags.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-100 rounded-full px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                {highFlags.length} High
              </span>
            )}
          </div>
        </div>
        {flags.length > 0 && mode === "plain" && (
          <p className="text-[11px] text-[#9b9b9b] mt-1">
            Highlighted text contains violations — click to see details.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {mode === "diarized" && segments ? (
          <div className="max-h-[560px] overflow-y-auto pr-1">
            <DiarizedTranscriptView segments={segments} />
          </div>
        ) : transcript ? (
          <div className="max-h-[560px] overflow-y-auto pr-1">
            <HighlightedTranscript transcript={transcript} flags={flags} />
          </div>
        ) : (
          <div className="py-8 text-center">
            <MessageSquare className="h-8 w-8 text-[#e0e0e0] mx-auto mb-2" />
            <p className="text-sm text-[#9b9b9b]">Transcript not available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Sentiment Timeline ───────────────────────────────────────────────────────

function SentimentTimeline({ points }: { points: SentimentPoint[] }) {
  if (!points || points.length === 0) {
    return (
      <p className="text-xs text-[#9b9b9b] text-center py-4">
        No sentiment data available
      </p>
    );
  }

  const sentCfg = {
    positive: { bg: "bg-green-500", text: "text-green-700", label: "Positive" },
    neutral: { bg: "bg-gray-300", text: "text-gray-600", label: "Neutral" },
    negative: { bg: "bg-red-500", text: "text-red-700", label: "Negative" },
  };

  return (
    <div className="space-y-3">
      {/* Bar visualization */}
      <div className="flex items-end gap-1 h-12">
        {points.map((p, i) => {
          const height =
            p.sentiment === "positive"
              ? 100
              : p.sentiment === "neutral"
                ? 60
                : 30;
          const cfg = sentCfg[p.sentiment];
          return (
            <TooltipProvider key={i} delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`flex-1 rounded-t cursor-pointer transition-opacity hover:opacity-80 ${cfg.bg}`}
                    style={{ height: `${height}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className={`text-xs font-semibold ${cfg.text}`}>
                    {cfg.label}
                  </p>
                  {p.label && (
                    <p className="text-[10px] text-[#555]">{p.label}</p>
                  )}
                  <p className="text-[10px] text-[#9b9b9b]">
                    {Math.round(p.position * 100)}% into call
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4">
        {(["positive", "neutral", "negative"] as const).map((s) => {
          const cfg = sentCfg[s];
          const count = points.filter((p) => p.sentiment === s).length;
          return (
            <div key={s} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${cfg.bg}`} />
              <span className={`text-xs font-medium ${cfg.text}`}>
                {cfg.label} ({count})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Coaching Card ────────────────────────────────────────────────────────────

function CoachingCard({ insights }: { insights: CoachingInsights }) {
  const sections = [
    {
      key: "strengths" as const,
      label: "Strengths",
      icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
      itemClass: "text-green-800",
      bg: "bg-green-50",
    },
    {
      key: "weaknesses" as const,
      label: "Areas for Improvement",
      icon: <XCircle className="h-4 w-4 text-red-600" />,
      itemClass: "text-red-800",
      bg: "bg-red-50",
    },
    {
      key: "opportunities" as const,
      label: "Opportunities",
      icon: <ArrowRight className="h-4 w-4 text-blue-600" />,
      itemClass: "text-blue-800",
      bg: "bg-blue-50",
    },
    {
      key: "recommended_training" as const,
      label: "Recommended Training",
      icon: <BookOpen className="h-4 w-4 text-purple-600" />,
      itemClass: "text-purple-800",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-3">
      {sections.map((sec) => {
        const items = insights[sec.key];
        if (!items || items.length === 0) return null;
        return (
          <div key={sec.key} className={`rounded-xl p-3 ${sec.bg}`}>
            <div className="flex items-center gap-1.5 mb-2">
              {sec.icon}
              <span className="text-xs font-semibold text-[#111]">
                {sec.label}
              </span>
            </div>
            <ul className="space-y-1">
              {items.map((item, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-1.5 text-xs ${sec.itemClass}`}
                >
                  <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 opacity-60" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {insights.coaching_plan && (
        <div className="rounded-xl border border-[#efefef] bg-[#fafafa] p-3">
          <p className="text-[10px] font-bold text-[#9b9b9b] uppercase tracking-widest mb-1.5">
            Coaching Plan
          </p>
          <p className="text-xs text-[#444] leading-relaxed">
            {insights.coaching_plan}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Key Moments Timeline ─────────────────────────────────────────────────────

function KeyMomentsTimeline({ moments }: { moments: KeyMoment[] }) {
  if (!moments || moments.length === 0) {
    return (
      <p className="text-xs text-[#9b9b9b] text-center py-4">
        No key moments recorded
      </p>
    );
  }

  const typeStyles: Record<
    string,
    { bg: string; text: string; icon: React.ReactNode }
  > = {
    compliance: {
      bg: "bg-red-100",
      text: "text-red-700",
      icon: <ShieldAlert className="h-3 w-3" />,
    },
    quality: {
      bg: "bg-blue-100",
      text: "text-blue-700",
      icon: <TrendingUp className="h-3 w-3" />,
    },
    coaching: {
      bg: "bg-green-100",
      text: "text-green-700",
      icon: <BookOpen className="h-3 w-3" />,
    },
    disclosure: {
      bg: "bg-purple-100",
      text: "text-purple-700",
      icon: <MessageSquare className="h-3 w-3" />,
    },
    opportunity: {
      bg: "bg-blue-100",
      text: "text-blue-700",
      icon: <Zap className="h-3 w-3" />,
    },
    default: {
      bg: "bg-gray-100",
      text: "text-gray-700",
      icon: <Clock className="h-3 w-3" />,
    },
  };

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-[#e8e8e8]" />
      {moments.map((m, i) => {
        const style = typeStyles[m.type] ?? typeStyles.default!;
        const pct =
          m.timestamp_pct !== undefined
            ? `${Math.round(m.timestamp_pct * 100)}%`
            : m.timestamp_s !== undefined
              ? `${Math.round(m.timestamp_s)}s`
              : null;

        return (
          <div key={i} className="flex items-start gap-3 pl-0.5 py-2">
            <div
              className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 z-10 ${style.bg} ${style.text}`}
            >
              {style.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-semibold capitalize px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}
                >
                  {m.type}
                </span>
                {pct && (
                  <span className="text-[10px] text-[#9b9b9b]">{pct}</span>
                )}
              </div>
              <p className="text-xs text-[#555] mt-0.5 leading-relaxed">
                {m.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function CallReviewSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-7 w-64" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      {/* Gauges */}
      <Card>
        <CardContent className="py-6">
          <div className="flex justify-around">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="h-[88px] w-[88px] rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Two columns */}
      <div className="grid grid-cols-5 gap-5">
        <div className="col-span-3">
          <Skeleton className="h-[480px] rounded-xl" />
        </div>
        <div className="col-span-2 space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ─── Review Status Panel ──────────────────────────────────────────────────────

const REVIEW_STATUSES = [
  "pending_review",
  "in_review",
  "reviewed",
  "approved",
  "disputed",
] as const;

const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending Review",
  in_review: "In Review",
  reviewed: "Reviewed",
  approved: "Approved",
  disputed: "Disputed",
};

const REVIEW_STATUS_COLOR: Record<string, string> = {
  pending_review: "text-gray-500 bg-gray-100 border-gray-200",
  in_review: "text-blue-700 bg-blue-50 border-blue-200",
  reviewed: "text-indigo-700 bg-indigo-50 border-indigo-200",
  approved: "text-green-700 bg-green-50 border-green-200",
  disputed: "text-red-700 bg-red-50 border-red-200",
};

function ReviewPanel({
  interaction,
  onUpdated,
}: {
  interaction: QACInteraction;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(interaction.review_status);
  const [notes, setNotes] = useState(interaction.reviewer_notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/qac/interactions/${interaction.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_status: status,
          reviewer_notes: notes,
        }),
      });
      if (!res.ok) throw new Error("Failed to update review");
      setEditing(false);
      onUpdated();
      toast.success("Review updated");
    } catch {
      toast.error("Failed to save review status");
    } finally {
      setSaving(false);
    }
  }

  const colorCls = REVIEW_STATUS_COLOR[interaction.review_status] ?? "text-gray-500 bg-gray-100 border-gray-200";

  return (
    <Card className="border-[#efefef]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#6b6b6b]" />
            Review
          </span>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-[#6b6b6b] hover:text-[#111] border border-[#e0e0e0] rounded-lg px-2 py-0.5 hover:border-[#111] transition-colors"
            >
              Edit
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <>
            <div>
              <label className="block text-[10px] font-medium text-[#9b9b9b] uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-sm text-[#111] focus:outline-none focus:ring-1 focus:ring-[#111]"
              >
                {REVIEW_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {REVIEW_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#9b9b9b] uppercase tracking-wider mb-1.5">
                Reviewer Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#111] focus:outline-none focus:ring-1 focus:ring-[#111] resize-none"
                placeholder="Add reviewer notes…"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void save()}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-[#111] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#333] disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setStatus(interaction.review_status);
                  setNotes(interaction.reviewer_notes ?? "");
                }}
                className="rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs text-[#6b6b6b] hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${colorCls}`}
            >
              {REVIEW_STATUS_LABEL[interaction.review_status] ?? interaction.review_status}
            </span>
            {interaction.reviewer_notes && (
              <p className="text-xs text-[#555] leading-relaxed">
                {interaction.reviewer_notes}
              </p>
            )}
            {interaction.reviewed_at && (
              <p className="text-[10px] text-[#9b9b9b]">
                Reviewed {format(new Date(interaction.reviewed_at), "MMM d, yyyy HH:mm")}
              </p>
            )}
            {interaction.approved_at && (
              <p className="text-[10px] text-[#9b9b9b]">
                Approved {format(new Date(interaction.approved_at), "MMM d, yyyy HH:mm")}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── QA Comments Panel ────────────────────────────────────────────────────────

function CommentsPanel({ interactionId }: { interactionId: string }) {
  const [comments, setComments] = useState<QACComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/qac/interactions/${interactionId}/comments`);
      if (!res.ok) return;
      setComments(await res.json());
    } finally {
      setLoadingComments(false);
    }
  }, [interactionId]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  async function submit() {
    const text = newComment.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/qac/interactions/${interactionId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: text }),
      });
      if (!res.ok) throw new Error("Failed to add comment");
      setNewComment("");
      await fetchComments();
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  }

  function fmtRelative(d: string) {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <Card className="border-[#efefef]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#6b6b6b]" />
          QA Comments
          {comments.length > 0 && (
            <span className="text-xs font-normal text-[#9b9b9b]">
              ({comments.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loadingComments ? (
          <div className="py-4 text-center">
            <Loader2 className="h-4 w-4 animate-spin text-[#9b9b9b] mx-auto" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-[#9b9b9b] text-center py-3">
            No comments yet
          </p>
        ) : (
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {comments.map((c) => (
              <div key={c.id} className="rounded-xl bg-[#f8f8f8] border border-[#efefef] p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-[#e0e0e0] flex items-center justify-center">
                    <User className="h-3 w-3 text-[#6b6b6b]" />
                  </div>
                  <span className="text-[10px] text-[#9b9b9b]">
                    {fmtRelative(c.created_at)}
                  </span>
                </div>
                <p className="text-xs text-[#444] leading-relaxed">{c.comment}</p>
              </div>
            ))}
          </div>
        )}

        {/* Add comment */}
        <div className="space-y-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
            }}
            rows={2}
            maxLength={2000}
            placeholder="Add a QA comment… (⌘↵ to submit)"
            className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-xs text-[#111] focus:outline-none focus:ring-1 focus:ring-[#111] resize-none placeholder:text-[#9b9b9b]"
          />
          <button
            onClick={() => void submit()}
            disabled={!newComment.trim() || submitting}
            className="flex items-center gap-1.5 rounded-lg bg-[#111] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#333] disabled:opacity-40 transition-colors"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Add Comment
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CallReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [interaction, setInteraction] = useState<QACInteraction | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [auditLogs, setAuditLogs] = useState<QACAuditLog[]>([]);
  const [complianceViolations, setComplianceViolations] = useState<ComplianceViolation[]>([]);
  const [markingFp, setMarkingFp] = useState<string | null>(null);

  const fetchInteraction = useCallback(async () => {
    try {
      const res = await fetch(`/api/qac/interactions/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as QACInteraction;
      setInteraction(data);
    } catch {
      toast.error("Failed to load interaction");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchInteraction();
  }, [fetchInteraction]);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/qac/audit-logs?entity_type=interaction&entity_id=${id}&limit=10`,
      );
      if (!res.ok) return; // 403 for non-admins — silently absent
      const json = (await res.json()) as { data: QACAuditLog[] };
      setAuditLogs(json.data ?? []);
    } catch {
      // non-critical — audit trail is supplementary
    }
  }, [id]);

  useEffect(() => {
    void fetchAuditLogs();
  }, [fetchAuditLogs]);

  const fetchViolations = useCallback(async () => {
    try {
      const res = await fetch(`/api/qac/interactions/${id}/violations`);
      if (!res.ok) return;
      const data = (await res.json()) as ComplianceViolation[];
      setComplianceViolations(data);
    } catch {
      // non-critical
    }
  }, [id]);

  useEffect(() => {
    void fetchViolations();
  }, [fetchViolations]);

  async function markFalsePositive(violationId: string) {
    setMarkingFp(violationId);
    try {
      const res = await fetch(`/api/qac/violations/${violationId}/false-positive`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Failed to mark as false positive");
      setComplianceViolations((prev) =>
        prev.map((v) => (v.id === violationId ? { ...v, is_false_positive: true } : v)),
      );
      toast.success("Marcado como falso positivo");
    } catch {
      toast.error("Error al marcar como falso positivo");
    } finally {
      setMarkingFp(null);
    }
  }

  async function handleAnalyze() {
    if (!interaction) return;
    setAnalyzing(true);
    setInteraction((prev) => (prev ? { ...prev, status: "analyzing" } : prev));
    try {
      const res = await fetch(`/api/qac/interactions/${id}/analyze`, {
        method: "POST",
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      toast.success("Analysis complete");
      await fetchInteraction();
    } catch (e) {
      toast.error(`Analysis failed: ${String(e)}`);
      setInteraction((prev) => (prev ? { ...prev, status: "failed" } : prev));
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) return <CallReviewSkeleton />;

  if (notFound) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Link
          href="/qa-center"
          className="inline-flex items-center gap-1.5 text-sm text-[#6b6b6b] hover:text-[#111] mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to QA Center
        </Link>
        <Card>
          <CardContent className="py-20 text-center">
            <ShieldAlert className="h-12 w-12 text-[#e0e0e0] mx-auto mb-4" />
            <p className="text-lg font-semibold text-[#111] mb-2">
              Interaction not found
            </p>
            <p className="text-sm text-[#6b6b6b] mb-6">
              This call review does not exist or you don&apos;t have access to
              it.
            </p>
            <Button asChild variant="outline">
              <Link href="/qa-center">Return to QA Center</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!interaction) return null;

  const evaluation = interaction.qac_evaluations?.[0];
  const flags = evaluation?.qac_flags ?? [];
  const criticalFlags = flags.filter((f) => f.severity === "critical");
  const highFlags = flags.filter((f) => f.severity === "high");
  const isPending =
    interaction.status === "pending" || interaction.status === "failed";
  const isAnalyzing = interaction.status === "analyzing" || analyzing;

  const criteriaConfig: { key: keyof CriteriaScores; label: string }[] = [
    { key: "opening", label: "Opening" },
    { key: "compliance", label: "Compliance" },
    { key: "objection_handling", label: "Sales" },
    { key: "closing", label: "Soft Skills" },
    { key: "empathy", label: "Empathy" },
  ];

  const CHANNEL_ICON: Record<string, React.ReactNode> = {
    call: <Phone className="h-3.5 w-3.5" />,
    chat: <MessageSquare className="h-3.5 w-3.5" />,
    email: <MessageSquare className="h-3.5 w-3.5" />,
    sms: <MessageSquare className="h-3.5 w-3.5" />,
    social: <Globe className="h-3.5 w-3.5" />,
    other: <Phone className="h-3.5 w-3.5" />,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-1.5 text-[#6b6b6b] hover:text-[#111] -ml-2"
        >
          <Link href="/qa-center">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#111] shrink-0">
            <ShieldAlert className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[#111] truncate leading-tight">
              Call Review &mdash; {interaction.agent_name}
            </h1>
            <p className="text-xs text-[#6b6b6b]">
              {format(new Date(interaction.created_at), "MMM d, yyyy · HH:mm")}
              {interaction.duration_s
                ? ` · ${formatDuration(interaction.duration_s)}`
                : ""}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {evaluation && (
            <RiskBadge score={Math.round(Number(evaluation.risk_score))} />
          )}

          {isPending && (
            <Button
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="gap-1.5"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <PlayCircle className="h-3.5 w-3.5" />
                  Analyze
                </>
              )}
            </Button>
          )}

          {isAnalyzing && !analyzing && (
            <Badge className="bg-blue-50 text-blue-700 border-blue-100 gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analyzing
            </Badge>
          )}

          {interaction.status === "failed" && !analyzing && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAnalyze}
              className="gap-1.5 text-red-600"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Retry Analysis
            </Button>
          )}
        </div>
      </div>

      {/* ── Review + Comments always visible ─────────────────────────────── */}
      {!evaluation && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ReviewPanel interaction={interaction} onUpdated={() => void fetchInteraction()} />
          <CommentsPanel interactionId={interaction.id} />
        </div>
      )}

      {/* ── No analysis yet ─────────────────────────────────────────────── */}
      {!evaluation && !isAnalyzing && (
        <Card className="border-dashed border-[#d0d0d0]">
          <CardContent className="py-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-[#f5f5f5] flex items-center justify-center mx-auto">
              <PlayCircle className="h-6 w-6 text-[#9b9b9b]" />
            </div>
            <p className="font-semibold text-[#111]">No analysis yet</p>
            <p className="text-sm text-[#6b6b6b] max-w-sm mx-auto">
              This interaction hasn&apos;t been analyzed yet. Run the AI auditor
              to get scores, compliance flags, and coaching recommendations.
            </p>
            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="gap-2"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" />
                  Run Analysis
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Analyzing state ──────────────────────────────────────────────── */}
      {isAnalyzing && !evaluation && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#6b6b6b] mx-auto" />
            <p className="font-semibold text-[#111]">Analyzing interaction…</p>
            <p className="text-sm text-[#6b6b6b]">
              The AI auditor is reviewing this call for compliance, quality, and
              coaching opportunities.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Audio player ────────────────────────────────────────────────── */}
      {interaction.audio_url && <AudioPlayer url={interaction.audio_url} />}

      {/* ── Critical compliance banner ───────────────────────────────── */}
      {complianceViolations.filter((v) => v.severity === "critical" && !v.is_false_positive).length > 0 && (
        <div className="flex items-start gap-3 rounded-xl bg-[#fafafa] border border-[#111] px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-[#111] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-[#111]">
              {complianceViolations.filter((v) => v.severity === "critical" && !v.is_false_positive).length} alerta
              {complianceViolations.filter((v) => v.severity === "critical" && !v.is_false_positive).length !== 1 ? "s" : ""} crítica
              {complianceViolations.filter((v) => v.severity === "critical" && !v.is_false_positive).length !== 1 ? "s" : ""} de compliance detectada
              {complianceViolations.filter((v) => v.severity === "critical" && !v.is_false_positive).length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-[#111] mt-0.5">
              Esta llamada contiene violaciones de reglas críticas. Revisa la sección de Alertas de Compliance abajo.
            </p>
          </div>
        </div>
      )}

      {/* ── Score gauges row ────────────────────────────────────────────── */}
      {evaluation && (
        <>
          <Card className="border-[#efefef]">
            <CardContent className="py-5 px-6">
              <div className="flex items-center justify-around gap-4 flex-wrap">
                {/* Overall score gauge */}
                <div className="flex flex-col items-center gap-2">
                  <ScoreGauge
                    score={Math.round(Number(evaluation.overall_score))}
                    label="Overall"
                    size={96}
                  />
                  <Badge
                    className={`text-[9px] px-2 py-0.5 border-transparent ${
                      evaluation.tone === "professional" ||
                      evaluation.tone === "friendly"
                        ? "bg-green-50 text-green-700"
                        : evaluation.tone === "unprofessional" ||
                            evaluation.tone === "aggressive"
                          ? "bg-red-50 text-red-700"
                          : "bg-gray-50 text-gray-600"
                    }`}
                  >
                    {evaluation.tone ?? "unknown"}
                  </Badge>
                </div>

                <div className="h-16 w-px bg-[#f0f0f0] hidden sm:block" />

                {/* Criteria gauges */}
                {criteriaConfig.map(({ key, label }) => (
                  <ScoreGauge
                    key={key}
                    score={Math.round(
                      Number(evaluation.criteria_scores?.[key] ?? 0),
                    )}
                    label={label}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Summary ──────────────────────────────────────────────────── */}
          {evaluation.summary && (
            <div className="flex items-start gap-3 rounded-xl bg-[#f8f8f8] border border-[#efefef] px-4 py-3">
              <TrendingUp className="h-4 w-4 text-[#9b9b9b] shrink-0 mt-0.5" />
              <p className="text-sm text-[#555] leading-relaxed">
                {evaluation.summary}
              </p>
            </div>
          )}

          {/* ── Two-column layout ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* LEFT — Transcript */}
            <div className="lg:col-span-3 space-y-4">
              <TranscriptCard
                transcript={interaction.transcript}
                diarizedRaw={interaction.diarized_transcript}
                flags={flags}
                criticalFlags={criticalFlags}
                highFlags={highFlags}
              />

              {/* Sentiment Timeline */}
              {evaluation.sentiment_timeline &&
                evaluation.sentiment_timeline.length > 0 && (
                  <Card className="border-[#efefef]">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        Sentiment Timeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <SentimentTimeline
                        points={evaluation.sentiment_timeline}
                      />
                    </CardContent>
                  </Card>
                )}
            </div>

            {/* RIGHT — Analysis panels */}
            <div className="lg:col-span-2 space-y-4">
              {/* Compliance Alerts */}
              <Card className="border-[#efefef]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-[#6b6b6b]" />
                      Alertas de Compliance
                    </span>
                    {complianceViolations.filter((v) => !v.is_false_positive).length > 0 && (
                      <div className="flex items-center gap-1.5">
                        {complianceViolations.filter((v) => v.severity === "critical" && !v.is_false_positive).length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#111] text-white border-transparent rounded-full px-2 py-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            {complianceViolations.filter((v) => v.severity === "critical" && !v.is_false_positive).length} Critical
                          </span>
                        )}
                        {complianceViolations.filter((v) => v.severity === "warning" && !v.is_false_positive).length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#f0f0f0] text-[#555] border border-[#e0e0e0] rounded-full px-2 py-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#9b9b9b]" />
                            {complianceViolations.filter((v) => v.severity === "warning" && !v.is_false_positive).length} Warning
                          </span>
                        )}
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {complianceViolations.filter((v) => !v.is_false_positive).length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-[#555] bg-[#fafafa] rounded-xl p-3 border border-[#efefef]">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Sin alertas de compliance — todas las reglas cumplidas.
                    </div>
                  ) : (
                    complianceViolations
                      .filter((v) => !v.is_false_positive)
                      .sort((a, b) => (a.severity === "critical" ? -1 : b.severity === "critical" ? 1 : 0))
                      .map((violation) => {
                        const isCritical = violation.severity === "critical";
                        return (
                          <div
                            key={violation.id}
                            className={`rounded-xl border p-3 space-y-2 ${
                              isCritical
                                ? "bg-[#fafafa] border-[#111]"
                                : "bg-white border-[#e0e0e0]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 min-w-0">
                                <span
                                  className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${
                                    isCritical ? "bg-[#111]" : "bg-[#9b9b9b]"
                                  }`}
                                />
                                <div className="min-w-0">
                                  <span
                                    className={`text-[10px] font-bold uppercase tracking-wide ${
                                      isCritical ? "text-[#111]" : "text-[#9b9b9b]"
                                    }`}
                                  >
                                    {isCritical ? "Critical" : "Warning"}
                                  </span>
                                  <p
                                    className={`text-sm font-semibold mt-0.5 ${
                                      isCritical ? "text-[#111]" : "text-[#555]"
                                    }`}
                                  >
                                    {violation.rule_name}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => void markFalsePositive(violation.id)}
                                disabled={markingFp === violation.id}
                                className="shrink-0 text-[10px] font-medium px-2 py-1 rounded-lg border transition-colors border-[#e0e0e0] text-[#6b6b6b] hover:border-[#111] hover:text-[#111] disabled:opacity-50"
                              >
                                {markingFp === violation.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Falso positivo"
                                )}
                              </button>
                            </div>
                            {violation.fragment && (
                              <blockquote
                                className="border-l-2 pl-2 text-xs italic text-[#555] border-[#e0e0e0]"
                              >
                                &ldquo;{violation.fragment}&rdquo;
                              </blockquote>
                            )}
                            {violation.confidence !== null && (
                              <p className="text-[10px] text-[#9b9b9b]">
                                Confianza: {Math.round(violation.confidence * 100)}%
                              </p>
                            )}
                          </div>
                        );
                      })
                  )}
                  {complianceViolations.some((v) => v.is_false_positive) && (
                    <p className="text-[10px] text-[#9b9b9b]">
                      {complianceViolations.filter((v) => v.is_false_positive).length} marcada
                      {complianceViolations.filter((v) => v.is_false_positive).length !== 1 ? "s" : ""} como falso positivo
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Violations */}
              <Card className="border-[#efefef]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Violations</span>
                    {flags.length > 0 && (
                      <span className="text-sm font-normal text-[#6b6b6b]">
                        {flags.length} flag{flags.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {flags.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl p-3 border border-green-100">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      No violations detected — fully compliant.
                    </div>
                  ) : (
                    flags.map((flag) => {
                      const sev = SEV_CFG[flag.severity] ?? SEV_CFG["medium"]!;
                      return (
                        <div
                          key={flag.id}
                          className={`rounded-xl border p-3 space-y-2 ${sev.bg} ${sev.border}`}
                        >
                          {/* Header */}
                          <div className="flex items-start gap-2 flex-wrap">
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${sev.dot}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`text-xs font-semibold ${sev.text}`}
                                >
                                  {sev.label}
                                </span>
                                <span
                                  className={`text-[10px] capitalize font-medium px-1.5 py-0.5 rounded border ${CAT_CFG[flag.category] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}
                                >
                                  {flag.category}
                                </span>
                                {flag.violation_type && (
                                  <span className="text-[10px] text-[#9b9b9b]">
                                    {flag.violation_type}
                                  </span>
                                )}
                              </div>
                              <p
                                className={`text-sm font-medium mt-0.5 ${sev.text}`}
                              >
                                {flag.label}
                              </p>
                            </div>
                          </div>

                          {/* Transcript snippet */}
                          {flag.transcript_fragment && (
                            <blockquote
                              className={`border-l-2 pl-2 text-xs italic ${sev.text} opacity-80 border-current/30`}
                            >
                              &ldquo;{flag.transcript_fragment}&rdquo;
                            </blockquote>
                          )}

                          {/* Regulation */}
                          {flag.regulation && (
                            <div className="flex items-center gap-1.5">
                              <ShieldAlert
                                className={`h-3 w-3 ${sev.text} opacity-70`}
                              />
                              <span
                                className={`text-[10px] font-mono font-medium ${sev.text}`}
                              >
                                {flag.regulation}
                              </span>
                            </div>
                          )}

                          {/* Suggested correction */}
                          {flag.suggested_correction && (
                            <div
                              className={`rounded-lg p-2 bg-white/50 space-y-0.5`}
                            >
                              <p
                                className={`text-[10px] font-bold uppercase tracking-widest ${sev.text} opacity-70`}
                              >
                                Suggested Correction
                              </p>
                              <p className={`text-xs ${sev.text}`}>
                                {flag.suggested_correction}
                              </p>
                            </div>
                          )}

                          {/* Coaching note */}
                          {flag.coaching_note && (
                            <div className="flex items-start gap-1.5">
                              <BookOpen
                                className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${sev.text} opacity-70`}
                              />
                              <p className={`text-xs ${sev.text} opacity-90`}>
                                <span className="font-semibold">
                                  Coaching:{" "}
                                </span>
                                {flag.coaching_note}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Coaching Insights */}
              {evaluation.coaching_insights &&
                Object.keys(evaluation.coaching_insights).length > 0 && (
                  <Card className="border-[#efefef]">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        Coaching Insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CoachingCard insights={evaluation.coaching_insights} />
                    </CardContent>
                  </Card>
                )}

              {/* Key Moments */}
              {evaluation.key_moments && evaluation.key_moments.length > 0 && (
                <Card className="border-[#efefef]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Key Moments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <KeyMomentsTimeline moments={evaluation.key_moments} />
                  </CardContent>
                </Card>
              )}

              {/* Review Status */}
              <ReviewPanel interaction={interaction} onUpdated={() => void fetchInteraction()} />

              {/* QA Comments */}
              <CommentsPanel interactionId={interaction.id} />
            </div>
          </div>

          {/* ── Call metadata ────────────────────────────────────────────── */}
          <Card className="border-[#efefef]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-[#6b6b6b] font-medium">
                Call Metadata
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                {[
                  {
                    label: "Agent",
                    value: interaction.agent_name,
                    icon: <User className="h-3.5 w-3.5" />,
                  },
                  {
                    label: "Agent ID",
                    value: interaction.agent_id ?? "—",
                    icon: <User className="h-3.5 w-3.5" />,
                  },
                  {
                    label: "Channel",
                    value: interaction.channel,
                    icon: CHANNEL_ICON[interaction.channel] ?? (
                      <Phone className="h-3.5 w-3.5" />
                    ),
                  },
                  {
                    label: "Direction",
                    value: interaction.direction ?? "—",
                    icon: <ArrowRight className="h-3.5 w-3.5" />,
                  },
                  {
                    label: "Duration",
                    value: interaction.duration_s
                      ? formatDuration(interaction.duration_s)
                      : "—",
                    icon: <Clock className="h-3.5 w-3.5" />,
                  },
                  {
                    label: "Language",
                    value: interaction.language ?? "—",
                    icon: <Globe className="h-3.5 w-3.5" />,
                  },
                  {
                    label: "Customer",
                    value: interaction.customer_id ?? "—",
                    icon: <User className="h-3.5 w-3.5" />,
                  },
                  {
                    label: "Campaign",
                    value: interaction.campaign ?? "—",
                    icon: <TrendingUp className="h-3.5 w-3.5" />,
                  },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="flex items-start gap-2">
                    <span className="text-[#9b9b9b] mt-0.5 shrink-0">
                      {icon}
                    </span>
                    <div>
                      <dt className="text-[10px] font-medium text-[#9b9b9b] uppercase tracking-wider">
                        {label}
                      </dt>
                      <dd className="text-sm font-medium text-[#111] capitalize">
                        {value}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>

              <div className="mt-4 pt-4 border-t border-[#f0f0f0] flex items-center gap-4 text-[10px] text-[#9b9b9b]">
                <span>
                  Created{" "}
                  {format(
                    new Date(interaction.created_at),
                    "MMM d, yyyy HH:mm",
                  )}
                </span>
                {evaluation && (
                  <span>
                    Analyzed{" "}
                    {format(
                      new Date(evaluation.evaluated_at),
                      "MMM d, yyyy HH:mm",
                    )}
                  </span>
                )}
                {evaluation && (
                  <span>
                    {evaluation.rules_applied} QA rule
                    {evaluation.rules_applied !== 1 ? "s" : ""} applied
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {auditLogs.length > 0 && (
            <Card className="border-[#efefef]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-[#6b6b6b]" />
                    Audit Trail
                  </span>
                  <Link
                    href="/qa-center/audit"
                    className="text-[11px] text-[#9b9b9b] hover:text-[#555] font-normal flex items-center gap-1"
                  >
                    View all
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {auditLogs.map((log) => {
                    const detail =
                      log.action === "review_status.change" && log.details
                        ? `${String((log.details as { from?: string }).from ?? "")} → ${String((log.details as { to?: string }).to ?? "")}`
                        : null;
                    return (
                      <div
                        key={log.id}
                        className="flex items-baseline gap-2.5 text-xs"
                      >
                        <span className="text-[#b0b0b0] tabular-nums shrink-0">
                          {format(new Date(log.created_at), "MMM d HH:mm")}
                        </span>
                        <span className="font-medium text-[#333]">
                          {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                        </span>
                        {detail && (
                          <span className="text-[#9b9b9b]">{detail}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
