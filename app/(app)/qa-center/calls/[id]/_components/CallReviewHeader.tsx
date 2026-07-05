"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  PlayCircle,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { QACInteraction, QACEvaluation } from "./types";
import { formatDuration } from "./format";
import { RiskBadge } from "./score-ui";

interface Props {
  interaction: QACInteraction;
  evaluation: QACEvaluation | undefined;
  analyzing: boolean;
  handleAnalyze: () => void;
}

export function CallReviewHeader({
  interaction,
  evaluation,
  analyzing,
  handleAnalyze,
}: Props) {
  const isPending =
    interaction.status === "pending" || interaction.status === "failed";
  const isAnalyzing = interaction.status === "analyzing" || analyzing;
  return (
    <>
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
    </>
  );
}
