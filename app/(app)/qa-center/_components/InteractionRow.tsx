"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { QACInteraction } from "./types";
import {
  ScorePill,
  RiskBar,
  SEV,
  CAT_COLOR,
  CHANNEL_ICON,
  CRITERIA_LABELS,
} from "./scoring";

// ─── Interaction Row ───────────────────────────────────────────────────────────

export function InteractionRow({
  interaction,
  onAnalyze,
  analyzing,
}: {
  interaction: QACInteraction;
  onAnalyze: (id: string) => void;
  analyzing: string | null;
}) {
  const [open, setOpen] = useState(false);
  const evaluation = interaction.qac_evaluations?.[0];
  const flags = evaluation?.qac_flags ?? [];
  const criticalCount = flags.filter(
    (f) => f.severity === "critical" || f.severity === "high",
  ).length;
  const isBusy =
    analyzing === interaction.id || interaction.status === "analyzing";

  return (
    <div className="border-b border-[#f0f0f0] last:border-0">
      {/* Summary row */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-[#fafafa] transition-colors select-none"
        onClick={() => evaluation && setOpen((o) => !o)}
      >
        <span className="text-[#c0c0c0] w-4 shrink-0">
          {evaluation ? (
            open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="h-4 w-4 block" />
          )}
        </span>

        {/* Channel */}
        <span className="flex items-center gap-1 text-[#9b9b9b] shrink-0">
          {CHANNEL_ICON[interaction.channel] ?? CHANNEL_ICON.other}
        </span>

        {/* Agent */}
        <span className="font-semibold text-sm text-[#111] w-36 truncate shrink-0">
          {interaction.agent_name}
        </span>

        {/* Date */}
        <span className="text-xs text-[#9b9b9b] w-28 shrink-0">
          {format(new Date(interaction.created_at), "MMM d, HH:mm")}
        </span>

        {/* Overall score */}
        {evaluation ? (
          <ScorePill score={Math.round(Number(evaluation.overall_score))} />
        ) : (
          <span className="w-10" />
        )}

        {/* Failed criteria tags (Sedric-style) */}
        {evaluation?.criteria_scores &&
          (() => {
            const failed = Object.entries(evaluation.criteria_scores)
              .filter(([, v]) => Math.round(Number(v)) < 70)
              .map(([k]) => CRITERIA_LABELS[k] ?? k);
            if (failed.length === 0) return null;
            const visible = failed.slice(0, 2);
            const extra = failed.length - visible.length;
            return (
              <div className="hidden lg:flex items-center gap-1 flex-wrap min-w-0 flex-1">
                {visible.map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 whitespace-nowrap"
                  >
                    {label}
                  </span>
                ))}
                {extra > 0 && (
                  <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                    +{extra}
                  </span>
                )}
              </div>
            );
          })()}

        {/* Risk */}
        {evaluation && (
          <div className="w-24 shrink-0 hidden xl:block">
            <RiskBar score={Math.round(Number(evaluation.risk_score))} />
          </div>
        )}

        {/* High/critical flags */}
        {criticalCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-semibold text-red-600 shrink-0">
            <AlertTriangle className="h-3.5 w-3.5" />
            {criticalCount}
          </span>
        )}

        {/* Tone */}
        {evaluation?.tone && (
          <span
            className={`text-[10px] font-medium capitalize px-1.5 py-0.5 rounded hidden lg:inline ${
              evaluation.tone === "professional" ||
              evaluation.tone === "friendly"
                ? "bg-green-50 text-green-700"
                : evaluation.tone === "unprofessional" ||
                    evaluation.tone === "aggressive"
                  ? "bg-red-50 text-red-700"
                  : "bg-gray-100 text-gray-600"
            }`}
          >
            {evaluation.tone}
          </span>
        )}

        {/* Status */}
        <span className="ml-auto shrink-0">
          {interaction.status === "analyzed" && (
            <Badge className="bg-green-50 text-green-700 border-transparent text-[10px]">
              Analyzed
            </Badge>
          )}
          {interaction.status === "analyzing" && (
            <Badge className="bg-blue-50 text-blue-700 border-transparent text-[10px]">
              <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />
              Analyzing
            </Badge>
          )}
          {interaction.status === "failed" && (
            <Badge className="bg-red-50 text-red-700 border-transparent text-[10px]">
              Failed
            </Badge>
          )}
          {interaction.status === "pending" && (
            <Badge variant="secondary" className="text-[10px]">
              Pending
            </Badge>
          )}
        </span>

        {(interaction.status === "pending" ||
          interaction.status === "failed") && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs shrink-0 gap-1"
            disabled={!!analyzing || isBusy}
            onClick={(e) => {
              e.stopPropagation();
              onAnalyze(interaction.id);
            }}
          >
            {isBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <PlayCircle className="h-3 w-3" />
            )}
            Analyze
          </Button>
        )}
      </div>

      {/* Expanded detail */}
      {open && evaluation && (
        <div className="px-5 pb-5 space-y-4 bg-[#fafafa] border-t border-[#f0f0f0]">
          {/* Summary */}
          {evaluation.summary && (
            <p className="text-sm text-[#555] pt-3">{evaluation.summary}</p>
          )}

          {/* Criteria scores */}
          {evaluation.criteria_scores && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {Object.entries(evaluation.criteria_scores).map(([key, val]) => {
                const v = Math.round(Number(val));
                return (
                  <div
                    key={key}
                    className="rounded-xl border border-[#efefef] bg-white p-2.5 text-center"
                  >
                    <p className="text-[10px] font-medium text-[#9b9b9b] capitalize mb-1.5">
                      {key.replace(/_/g, " ")}
                    </p>
                    <p
                      className={`text-xl font-bold ${v >= 70 ? "text-green-600" : v >= 45 ? "text-yellow-600" : "text-red-600"}`}
                    >
                      {v}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Flags */}
          {flags.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-[#9b9b9b] uppercase tracking-widest">
                {flags.length} Flag{flags.length !== 1 ? "s" : ""} Detected
              </p>
              {flags.map((flag) => {
                const sc = SEV[flag.severity] ?? SEV["medium"]!;
                return (
                  <div key={flag.id} className={`rounded-xl p-3 ${sc.bg}`}>
                    <div className="flex items-start gap-2 mb-1.5">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${sc.dot}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold text-sm ${sc.text}`}>
                            {flag.label}
                          </span>
                          {flag.regulation && (
                            <span className="text-[10px] font-mono bg-black/[0.06] px-1.5 py-0.5 rounded">
                              {flag.regulation}
                            </span>
                          )}
                          <span
                            className={`text-[10px] capitalize font-medium px-1.5 py-0.5 rounded ${CAT_COLOR[flag.category] ?? ""}`}
                          >
                            {flag.category}
                          </span>
                        </div>
                        {flag.transcript_fragment && (
                          <p
                            className={`text-xs italic border-l-2 border-current/20 pl-2 mt-1.5 mb-1 line-clamp-3 ${sc.text}`}
                          >
                            "{flag.transcript_fragment}"
                          </p>
                        )}
                        {flag.coaching_note && (
                          <p className={`text-xs ${sc.text} opacity-80`}>
                            <span className="font-semibold">Coaching:</span>{" "}
                            {flag.coaching_note}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl p-3 border border-green-100">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              No flags detected — fully compliant interaction.
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-[#c0c0c0]">
              Analyzed{" "}
              {format(new Date(evaluation.evaluated_at), "MMM d, yyyy HH:mm")} ·{" "}
              {evaluation.rules_applied} rules applied
            </p>
            <Link
              href={`/qa-center/calls/${interaction.id}`}
              className="flex items-center gap-1 text-[10px] font-medium text-[#9b9b9b] hover:text-[#111] transition-colors border border-[#e0e0e0] rounded-lg px-2 py-1 hover:border-[#111]"
              onClick={(e) => e.stopPropagation()}
            >
              View Full Review →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
