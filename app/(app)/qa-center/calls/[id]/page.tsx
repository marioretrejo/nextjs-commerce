"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  PlayCircle,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import type {
  QACInteraction,
  ComplianceViolation,
  QACAuditLog,
} from "./_components/types";
import { AudioPlayer } from "./_components/AudioPlayer";
import { CallReviewSkeleton } from "./_components/CallReviewSkeleton";
import { ReviewPanel } from "./_components/ReviewPanel";
import { CommentsPanel } from "./_components/CommentsPanel";
import { CallReviewHeader } from "./_components/CallReviewHeader";
import { AnalyzedReview } from "./_components/AnalyzedReview";

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
  const isPending =
    interaction.status === "pending" || interaction.status === "failed";
  const isAnalyzing = interaction.status === "analyzing" || analyzing;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <CallReviewHeader
        interaction={interaction}
        evaluation={evaluation}
        analyzing={analyzing}
        handleAnalyze={handleAnalyze}
      />

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

      {evaluation && (
        <AnalyzedReview
          interaction={interaction}
          evaluation={evaluation}
          flags={flags}
          complianceViolations={complianceViolations}
          complianceEnabled={complianceEnabled}
          selectedViolations={selectedViolations}
          setSelectedViolations={setSelectedViolations}
          markFalsePositive={markFalsePositive}
          markBulkFalsePositive={markBulkFalsePositive}
          markingFp={markingFp}
          bulkMarking={bulkMarking}
          auditLogs={auditLogs}
          auditLogsHasMore={auditLogsHasMore}
          loadMoreAuditLogs={loadMoreAuditLogs}
          loadingMoreAudit={loadingMoreAudit}
          onReviewUpdated={() => void fetchInteraction()}
        />
      )}
    </div>
  );
}
