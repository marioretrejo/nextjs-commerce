"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { QACFlag, QACDiarizedTranscriptSegment } from "./types";
import {
  parseDiarizedSegments,
  formatTimestamp,
  resolveSpeakerLabel,
} from "./format";
import { SEV_CFG, CAT_CFG, SPEAKER_COLORS } from "./config";

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

export function TranscriptCard({
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
