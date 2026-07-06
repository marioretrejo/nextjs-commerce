"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Circle, Shield, ShieldAlert, Zap } from "lucide-react";
import { toast } from "sonner";
import type {
  AssistAlert,
  AssistResponse,
  ComplianceRisk,
} from "./_components/types";
import { RISK_CFG, DEBOUNCE_MS, genId } from "./_components/config";
import { TranscriptPanel } from "./_components/TranscriptPanel";
import { AlertsPanel } from "./_components/AlertsPanel";
import { InstructionsStrip } from "./_components/InstructionsStrip";

export default function AgentAssistPage() {
  const [transcript, setTranscript] = useState("");
  const [alerts, setAlerts] = useState<AssistAlert[]>([]);
  const [suggestedResponse, setSuggested] = useState<string>("");
  const [complianceRisk, setRisk] = useState<ComplianceRisk>("none");
  const [coachingTip, setCoachingTip] = useState<string>("");
  const [keyTopics, setKeyTopics] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [active, setActive] = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<Date | null>(null);
  const [newAlertIds, setNewAlertIds] = useState<Set<string>>(new Set());
  const [countdown, setCountdown] = useState(0); // 0–1 fraction
  const [alertHistory, setAlertHistory] = useState<AssistAlert[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTranscript = useRef("");

  const MAX_ALERTS = 5;

  // Clear countdown interval on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const runAnalysis = useCallback(
    async (text: string) => {
      if (!text.trim() || text.trim().length < 30) return;
      if (analyzing) return;

      setAnalyzing(true);
      setCountdown(0);
      if (countdownRef.current) clearInterval(countdownRef.current);

      try {
        const res = await fetch("/api/qac/assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: text }),
        });

        if (!res.ok) {
          const err = (await res.json()) as { error: string };
          throw new Error(err.error ?? "Analysis failed");
        }

        const data = (await res.json()) as AssistResponse;

        // Build new alert objects
        const newAlerts: AssistAlert[] = (data.alerts ?? []).map((a) => ({
          ...a,
          id: genId(),
          timestamp: new Date(),
        }));

        const newIds = new Set(newAlerts.map((a) => a.id));
        setNewAlertIds(newIds);
        setTimeout(() => setNewAlertIds(new Set()), 2500);

        // Keep last MAX_ALERTS active
        setAlerts((prev) => {
          const combined = [...newAlerts, ...prev];
          return combined.slice(0, MAX_ALERTS);
        });

        // Archive to history
        setAlertHistory((prev) => [...newAlerts, ...prev].slice(0, 50));

        if (data.suggested_response) setSuggested(data.suggested_response);
        if (data.compliance_risk) setRisk(data.compliance_risk);
        if (data.coaching_tip) setCoachingTip(data.coaching_tip);
        if (data.key_topics?.length) setKeyTopics(data.key_topics);
        setLastAnalyzedAt(new Date());
      } catch (e) {
        toast.error(`Assist analysis failed: ${String(e)}`);
      } finally {
        setAnalyzing(false);
      }
    },
    [analyzing],
  );

  // Debounced auto-analyze — kick off on every transcript change when active
  function handleTranscriptChange(value: string) {
    setTranscript(value);

    if (!active) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Animate countdown ring
    const startMs = Date.now();
    setCountdown(1);
    countdownRef.current = setInterval(() => {
      const elapsed = Date.now() - startMs;
      const remaining = Math.max(0, 1 - elapsed / DEBOUNCE_MS);
      setCountdown(remaining);
      if (elapsed >= DEBOUNCE_MS && countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }, 80);

    debounceRef.current = setTimeout(() => {
      if (value !== lastTranscript.current) {
        lastTranscript.current = value;
        void runAnalysis(value);
      }
    }, DEBOUNCE_MS);
  }

  function handleManualAnalyze() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(0);
    lastTranscript.current = transcript;
    void runAnalysis(transcript);
  }

  function toggleActive() {
    setActive((a) => !a);
    if (active) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(0);
    }
  }

  function dismissAlert(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  function clearAll() {
    setAlerts([]);
    setSuggested("");
    setCoachingTip("");
    setKeyTopics([]);
    setRisk("none");
  }

  async function copyResponse() {
    if (!suggestedResponse) return;
    try {
      await navigator.clipboard.writeText(suggestedResponse);
      toast.success("Response copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  const riskCfg = RISK_CFG[complianceRisk];
  const dangerCount = alerts.filter((a) => a.type === "danger").length;
  const warningCount = alerts.filter((a) => a.type === "warning").length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
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

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111] shrink-0">
            <Zap className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111] leading-tight">
              Live Agent Assist
            </h1>
            <p className="text-xs text-[#6b6b6b]">
              Real-time compliance and coaching guidance during calls
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Risk indicator */}
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${riskCfg.pill}`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span className={`h-2 w-2 rounded-full ${riskCfg.dot}`} />
            {riskCfg.label}
          </div>

          {/* Active toggle */}
          <button
            onClick={toggleActive}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "bg-[#111] text-white border-transparent"
                : "bg-white text-[#6b6b6b] border-[#e0e0e0] hover:border-[#111]"
            }`}
          >
            {active ? (
              <>
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                Active
              </>
            ) : (
              <>
                <Circle className="h-3 w-3" />
                Inactive
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Alert strip — danger/warning summary ─────────────────────── */}
      {(dangerCount > 0 || warningCount > 0) && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-800 font-medium flex-1">
            {dangerCount > 0 && (
              <>
                <span className="font-bold">
                  {dangerCount} critical alert{dangerCount !== 1 ? "s" : ""}
                </span>{" "}
                require immediate attention.{" "}
              </>
            )}
            {warningCount > 0 && (
              <span>
                {warningCount} warning{warningCount !== 1 ? "s" : ""} detected.
              </span>
            )}
          </p>
          <button
            onClick={clearAll}
            className="text-xs text-red-600 font-medium hover:underline shrink-0"
          >
            Dismiss all
          </button>
        </div>
      )}

      {/* ── Main layout: input + alerts ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <TranscriptPanel
          transcript={transcript}
          active={active}
          countdown={countdown}
          analyzing={analyzing}
          lastAnalyzedAt={lastAnalyzedAt}
          suggestedResponse={suggestedResponse}
          onChange={handleTranscriptChange}
          onManualAnalyze={handleManualAnalyze}
          onClear={() => {
            setTranscript("");
            clearAll();
            lastTranscript.current = "";
          }}
          onCopy={copyResponse}
        />

        <AlertsPanel
          alerts={alerts}
          analyzing={analyzing}
          active={active}
          dangerCount={dangerCount}
          newAlertIds={newAlertIds}
          coachingTip={coachingTip}
          keyTopics={keyTopics}
          alertHistory={alertHistory}
          showHistory={showHistory}
          onDismiss={dismissAlert}
          onClearAll={clearAll}
          onToggleHistory={() => setShowHistory((h) => !h)}
          onToggleActive={toggleActive}
        />
      </div>

      {/* ── Instructions / tips ──────────────────────────────────────────── */}
      <InstructionsStrip />
    </div>
  );
}
