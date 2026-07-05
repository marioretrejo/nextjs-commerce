"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SentimentPoint } from "./types";

export function SentimentTimeline({ points }: { points: SentimentPoint[] }) {
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
