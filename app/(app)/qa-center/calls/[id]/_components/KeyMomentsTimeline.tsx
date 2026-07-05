"use client";

import {
  BookOpen,
  Clock,
  MessageSquare,
  ShieldAlert,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { KeyMoment } from "./types";

export function KeyMomentsTimeline({ moments }: { moments: KeyMoment[] }) {
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
