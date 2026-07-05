"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  BookOpen,
  CheckCircle2,
  Loader2,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ComplianceViolation, QACFlag } from "./types";
import { SEV_CFG, CAT_CFG } from "./config";

interface Props {
  complianceViolations: ComplianceViolation[] | null;
  complianceEnabled: boolean | null;
  selectedViolations: Set<string>;
  setSelectedViolations: Dispatch<SetStateAction<Set<string>>>;
  markFalsePositive: (violationId: string) => void;
  markBulkFalsePositive: () => void;
  markingFp: string | null;
  bulkMarking: boolean;
  flags: QACFlag[];
}

export function ComplianceSection({
  complianceViolations,
  complianceEnabled,
  selectedViolations,
  setSelectedViolations,
  markFalsePositive,
  markBulkFalsePositive,
  markingFp,
  bulkMarking,
  flags,
}: Props) {
  return (
    <>
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
                            onClick={() => setSelectedViolations(new Set())}
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
                        Sin alertas de compliance — todas las reglas cumplidas.
                      </div>
                    ) : (
                      active.map((violation) => {
                        const isCritical = violation.severity === "critical";
                        const isSelected = selectedViolations.has(violation.id);
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
                                    {isCritical ? "Critical" : "Warning"}
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
                                {Math.round(violation.confidence * 100)}%
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                    {fpCount > 0 && (
                      <p className="text-[10px] text-[#9b9b9b]">
                        {fpCount} marcada{fpCount !== 1 ? "s" : ""} como falso
                        positivo
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
                        <span className={`text-xs font-semibold ${sev.text}`}>
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
                      <p className={`text-sm font-medium mt-0.5 ${sev.text}`}>
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
                    <div className={`rounded-lg p-2 bg-white/50 space-y-0.5`}>
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
                        <span className="font-semibold">Coaching: </span>
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
    </>
  );
}
