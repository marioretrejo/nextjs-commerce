"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  MessageSquare,
  Phone,
  PlayCircle,
  Shield,
  ShieldAlert,
  TrendingUp,
  User,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type {
  CriteriaScores,
  QACInteraction,
  ComplianceViolation,
  QACAuditLog,
} from "./_components/types";
import { formatDuration } from "./_components/format";
import { SEV_CFG, CAT_CFG, AUDIT_ACTION_LABELS } from "./_components/config";
import { AudioPlayer } from "./_components/AudioPlayer";
import { ScoreGauge, RiskBadge } from "./_components/score-ui";
import { TranscriptCard } from "./_components/TranscriptCard";
import { SentimentTimeline } from "./_components/SentimentTimeline";
import { CoachingCard } from "./_components/CoachingCard";
import { KeyMomentsTimeline } from "./_components/KeyMomentsTimeline";
import { CallReviewSkeleton } from "./_components/CallReviewSkeleton";
import { ReviewPanel } from "./_components/ReviewPanel";
import { CommentsPanel } from "./_components/CommentsPanel";

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
  const [auditLogsHasMore, setAuditLogsHasMore] = useState(false);
  const [auditLogsOffset, setAuditLogsOffset] = useState(0);
  const [loadingMoreAudit, setLoadingMoreAudit] = useState(false);
  const [complianceViolations, setComplianceViolations] = useState<
    ComplianceViolation[] | null
  >(null);
  const [complianceEnabled, setComplianceEnabled] = useState<boolean | null>(
    null,
  ); // null = loading
  const [markingFp, setMarkingFp] = useState<string | null>(null);
  const [selectedViolations, setSelectedViolations] = useState<Set<string>>(
    new Set(),
  );
  const [bulkMarking, setBulkMarking] = useState(false);

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

  const AUDIT_PAGE_SIZE = 5;

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/qac/audit-logs?entity_type=interaction&entity_id=${id}&limit=${AUDIT_PAGE_SIZE + 1}`,
      );
      if (!res.ok) return;
      const json = (await res.json()) as { data: QACAuditLog[] };
      const rows = json.data ?? [];
      setAuditLogsHasMore(rows.length > AUDIT_PAGE_SIZE);
      setAuditLogs(rows.slice(0, AUDIT_PAGE_SIZE));
      setAuditLogsOffset(AUDIT_PAGE_SIZE);
    } catch {
      // non-critical
    }
  }, [id]);

  async function loadMoreAuditLogs() {
    setLoadingMoreAudit(true);
    try {
      const res = await fetch(
        `/api/qac/audit-logs?entity_type=interaction&entity_id=${id}&limit=${AUDIT_PAGE_SIZE + 1}&offset=${auditLogsOffset}`,
      );
      if (!res.ok) return;
      const json = (await res.json()) as { data: QACAuditLog[] };
      const rows = json.data ?? [];
      setAuditLogsHasMore(rows.length > AUDIT_PAGE_SIZE);
      setAuditLogs((prev) => [...prev, ...rows.slice(0, AUDIT_PAGE_SIZE)]);
      setAuditLogsOffset((prev) => prev + AUDIT_PAGE_SIZE);
    } catch {
      // non-critical
    } finally {
      setLoadingMoreAudit(false);
    }
  }

  useEffect(() => {
    void fetchAuditLogs();
  }, [fetchAuditLogs]);

  const fetchViolations = useCallback(async () => {
    try {
      const res = await fetch(`/api/qac/interactions/${id}/violations`);
      if (res.status === 403) {
        setComplianceEnabled(false);
        setComplianceViolations([]);
        return;
      }
      if (!res.ok) {
        setComplianceEnabled(true);
        setComplianceViolations([]);
        return;
      }
      const data = (await res.json()) as ComplianceViolation[];
      setComplianceEnabled(true);
      setComplianceViolations(data);
    } catch {
      setComplianceEnabled(true);
      setComplianceViolations([]);
    }
  }, [id]);

  useEffect(() => {
    void fetchViolations();
  }, [fetchViolations]);

  async function markFalsePositive(violationId: string) {
    setMarkingFp(violationId);
    try {
      const res = await fetch(
        `/api/qac/violations/${violationId}/false-positive`,
        {
          method: "PUT",
        },
      );
      if (!res.ok) throw new Error("Failed to mark as false positive");
      setComplianceViolations(
        (prev) =>
          prev?.map((v) =>
            v.id === violationId ? { ...v, is_false_positive: true } : v,
          ) ?? prev,
      );
      toast.success("Marcado como falso positivo");
    } catch {
      toast.error("Error al marcar como falso positivo");
    } finally {
      setMarkingFp(null);
    }
  }

  async function markBulkFalsePositive() {
    const ids = Array.from(selectedViolations);
    if (ids.length === 0) return;
    setBulkMarking(true);
    try {
      const res = await fetch("/api/qac/violations/bulk-false-positive", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Bulk action failed");
      setComplianceViolations(
        (prev) =>
          prev?.map((v) =>
            selectedViolations.has(v.id)
              ? { ...v, is_false_positive: true }
              : v,
          ) ?? prev,
      );
      setSelectedViolations(new Set());
      toast.success(
        `${ids.length} violación${ids.length !== 1 ? "es" : ""} marcada${ids.length !== 1 ? "s" : ""} como falso positivo`,
      );
    } catch {
      toast.error("Error al marcar como falso positivo");
    } finally {
      setBulkMarking(false);
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
          <ReviewPanel
            interaction={interaction}
            onUpdated={() => void fetchInteraction()}
          />
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
      {(() => {
        const criticalCount =
          complianceViolations?.filter(
            (v) => v.severity === "critical" && !v.is_false_positive,
          ).length ?? 0;
        if (criticalCount === 0) return null;
        const plural = criticalCount !== 1;
        return (
          <div className="flex items-start gap-3 rounded-xl bg-[#fafafa] border border-[#111] px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-[#111] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-[#111]">
                {criticalCount} alerta{plural ? "s" : ""} crítica
                {plural ? "s" : ""} de compliance detectada{plural ? "s" : ""}
              </p>
              <p className="text-xs text-[#111] mt-0.5">
                Esta llamada contiene violaciones de reglas críticas. Revisa la
                sección de Alertas de Compliance abajo.
              </p>
            </div>
          </div>
        );
      })()}

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
              {/* Compliance Alerts — only if compliance module enabled */}
              {complianceEnabled !== false && (
                <Card className="border-[#efefef]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-[#6b6b6b]" />
                        Alertas de Compliance
                      </span>
                      {complianceViolations !== null &&
                        (() => {
                          const active = complianceViolations.filter(
                            (v) => !v.is_false_positive,
                          );
                          const criticalN = active.filter(
                            (v) => v.severity === "critical",
                          ).length;
                          const warningN = active.filter(
                            (v) => v.severity === "warning",
                          ).length;
                          if (active.length === 0) return null;
                          return (
                            <div className="flex items-center gap-1.5">
                              {criticalN > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#111] text-white border-transparent rounded-full px-2 py-0.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                  {criticalN} Critical
                                </span>
                              )}
                              {warningN > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#f0f0f0] text-[#555] border border-[#e0e0e0] rounded-full px-2 py-0.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-[#9b9b9b]" />
                                  {warningN} Warning
                                </span>
                              )}
                            </div>
                          );
                        })()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {complianceViolations === null ? (
                      <div className="space-y-2">
                        <Skeleton className="h-12 w-full rounded-xl" />
                        <Skeleton className="h-12 w-full rounded-xl" />
                      </div>
                    ) : (
                      (() => {
                        const active = complianceViolations
                          .filter((v) => !v.is_false_positive)
                          .sort((a, b) =>
                            a.severity === "critical"
                              ? -1
                              : b.severity === "critical"
                                ? 1
                                : 0,
                          );
                        const fpCount = complianceViolations.filter(
                          (v) => v.is_false_positive,
                        ).length;
                        return (
                          <>
                            {/* Bulk action bar */}
                            {selectedViolations.size > 0 && (
                              <div className="flex items-center justify-between gap-2 rounded-lg bg-[#f8f8f8] border border-[#e0e0e0] px-3 py-2">
                                <span className="text-xs text-[#555]">
                                  {selectedViolations.size} seleccionada
                                  {selectedViolations.size !== 1 ? "s" : ""}
                                </span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      setSelectedViolations(new Set())
                                    }
                                    className="text-[10px] px-2 py-1 rounded border border-[#e0e0e0] text-[#6b6b6b] hover:text-[#111]"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    onClick={() => void markBulkFalsePositive()}
                                    disabled={bulkMarking}
                                    className="text-[10px] px-2 py-1 rounded bg-[#111] text-white hover:bg-[#333] disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {bulkMarking ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : null}
                                    Marcar como falso positivo
                                  </button>
                                </div>
                              </div>
                            )}
                            {active.length === 0 ? (
                              <div className="flex items-center gap-2 text-sm text-[#555] bg-[#fafafa] rounded-xl p-3 border border-[#efefef]">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                Sin alertas de compliance — todas las reglas
                                cumplidas.
                              </div>
                            ) : (
                              active.map((violation) => {
                                const isCritical =
                                  violation.severity === "critical";
                                const isSelected = selectedViolations.has(
                                  violation.id,
                                );
                                return (
                                  <div
                                    key={violation.id}
                                    className={`rounded-xl border p-3 space-y-2 ${
                                      isSelected
                                        ? "border-[#111] bg-[#f8f8f8]"
                                        : isCritical
                                          ? "bg-[#fafafa] border-[#111]"
                                          : "bg-white border-[#e0e0e0]"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-start gap-2 min-w-0">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            setSelectedViolations((prev) => {
                                              const next = new Set(prev);
                                              if (e.target.checked)
                                                next.add(violation.id);
                                              else next.delete(violation.id);
                                              return next;
                                            });
                                          }}
                                          className="mt-1 h-3.5 w-3.5 shrink-0 accent-[#111] cursor-pointer"
                                        />
                                        <span
                                          className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${isCritical ? "bg-[#111]" : "bg-[#9b9b9b]"}`}
                                        />
                                        <div className="min-w-0">
                                          <span
                                            className={`text-[10px] font-bold uppercase tracking-wide ${isCritical ? "text-[#111]" : "text-[#9b9b9b]"}`}
                                          >
                                            {isCritical
                                              ? "Critical"
                                              : "Warning"}
                                          </span>
                                          <p
                                            className={`text-sm font-semibold mt-0.5 ${isCritical ? "text-[#111]" : "text-[#555]"}`}
                                          >
                                            {violation.rule_name}
                                          </p>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() =>
                                          void markFalsePositive(violation.id)
                                        }
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
                                      <blockquote className="border-l-2 pl-2 text-xs italic text-[#555] border-[#e0e0e0]">
                                        &ldquo;{violation.fragment}&rdquo;
                                      </blockquote>
                                    )}
                                    {violation.confidence !== null && (
                                      <p className="text-[10px] text-[#9b9b9b]">
                                        Confianza:{" "}
                                        {Math.round(violation.confidence * 100)}
                                        %
                                      </p>
                                    )}
                                  </div>
                                );
                              })
                            )}
                            {fpCount > 0 && (
                              <p className="text-[10px] text-[#9b9b9b]">
                                {fpCount} marcada{fpCount !== 1 ? "s" : ""} como
                                falso positivo
                              </p>
                            )}
                          </>
                        );
                      })()
                    )}
                  </CardContent>
                </Card>
              )}

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
              <ReviewPanel
                interaction={interaction}
                onUpdated={() => void fetchInteraction()}
              />

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
                  {auditLogsHasMore && (
                    <button
                      onClick={() => void loadMoreAuditLogs()}
                      disabled={loadingMoreAudit}
                      className="mt-1 text-[11px] text-[#6b6b6b] hover:text-[#111] flex items-center gap-1 disabled:opacity-50"
                    >
                      {loadingMoreAudit ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                      Cargar más
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
