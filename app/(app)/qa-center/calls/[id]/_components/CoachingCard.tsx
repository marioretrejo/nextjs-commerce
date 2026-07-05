"use client";

import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  XCircle,
  ArrowRight,
} from "lucide-react";
import type { CoachingInsights } from "./types";

export function CoachingCard({ insights }: { insights: CoachingInsights }) {
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
