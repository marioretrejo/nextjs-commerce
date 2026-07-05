"use client";

import type { Dispatch, SetStateAction } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  QACInteraction,
  QACEvaluation,
  QACFlag,
  ComplianceViolation,
  QACAuditLog,
  CriteriaScores,
} from "./types";
import { ScoreGauge } from "./score-ui";
import { TranscriptCard } from "./TranscriptCard";
import { SentimentTimeline } from "./SentimentTimeline";
import { ComplianceSection } from "./ComplianceSection";
import { CoachingCard } from "./CoachingCard";
import { KeyMomentsTimeline } from "./KeyMomentsTimeline";
import { ReviewPanel } from "./ReviewPanel";
import { CommentsPanel } from "./CommentsPanel";
import { CallMetadataPanel } from "./CallMetadataPanel";

interface Props {
  interaction: QACInteraction;
  evaluation: QACEvaluation;
  flags: QACFlag[];
  complianceViolations: ComplianceViolation[] | null;
  complianceEnabled: boolean | null;
  selectedViolations: Set<string>;
  setSelectedViolations: Dispatch<SetStateAction<Set<string>>>;
  markFalsePositive: (violationId: string) => void;
  markBulkFalsePositive: () => void;
  markingFp: string | null;
  bulkMarking: boolean;
  auditLogs: QACAuditLog[];
  auditLogsHasMore: boolean;
  loadMoreAuditLogs: () => void;
  loadingMoreAudit: boolean;
  onReviewUpdated: () => void;
}

export function AnalyzedReview({
  interaction,
  evaluation,
  flags,
  complianceViolations,
  complianceEnabled,
  selectedViolations,
  setSelectedViolations,
  markFalsePositive,
  markBulkFalsePositive,
  markingFp,
  bulkMarking,
  auditLogs,
  auditLogsHasMore,
  loadMoreAuditLogs,
  loadingMoreAudit,
  onReviewUpdated,
}: Props) {
  const criticalFlags = flags.filter((f) => f.severity === "critical");
  const highFlags = flags.filter((f) => f.severity === "high");
  const criteriaConfig: { key: keyof CriteriaScores; label: string }[] = [
    { key: "opening", label: "Opening" },
    { key: "compliance", label: "Compliance" },
    { key: "objection_handling", label: "Sales" },
    { key: "closing", label: "Soft Skills" },
    { key: "empathy", label: "Empathy" },
  ];
  return (
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
                  <SentimentTimeline points={evaluation.sentiment_timeline} />
                </CardContent>
              </Card>
            )}
        </div>

        {/* RIGHT — Analysis panels */}
        <div className="lg:col-span-2 space-y-4">
          {/* Compliance Alerts — only if compliance module enabled */}
          <ComplianceSection
            complianceViolations={complianceViolations}
            complianceEnabled={complianceEnabled}
            selectedViolations={selectedViolations}
            setSelectedViolations={setSelectedViolations}
            markFalsePositive={markFalsePositive}
            markBulkFalsePositive={markBulkFalsePositive}
            markingFp={markingFp}
            bulkMarking={bulkMarking}
            flags={flags}
          />

          {/* Coaching Insights */}
          {evaluation.coaching_insights &&
            Object.keys(evaluation.coaching_insights).length > 0 && (
              <Card className="border-[#efefef]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Coaching Insights</CardTitle>
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
          <ReviewPanel
            interaction={interaction}
            onUpdated={() => onReviewUpdated()}
          />

          {/* QA Comments */}
          <CommentsPanel interactionId={interaction.id} />
        </div>
      </div>

      <CallMetadataPanel
        interaction={interaction}
        evaluation={evaluation}
        auditLogs={auditLogs}
        auditLogsHasMore={auditLogsHasMore}
        loadMoreAuditLogs={loadMoreAuditLogs}
        loadingMoreAudit={loadingMoreAudit}
      />
    </>
  );
}
