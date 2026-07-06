"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  ShieldAlert,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { AssistAlert } from "./types";
import { ALERT_CFG, DEBOUNCE_MS, relativeTime } from "./config";
import { AlertCard } from "./AlertCard";

export function AlertsPanel({
  alerts,
  analyzing,
  active,
  dangerCount,
  newAlertIds,
  coachingTip,
  keyTopics,
  alertHistory,
  showHistory,
  onDismiss,
  onClearAll,
  onToggleHistory,
  onToggleActive,
}: {
  alerts: AssistAlert[];
  analyzing: boolean;
  active: boolean;
  dangerCount: number;
  newAlertIds: Set<string>;
  coachingTip: string;
  keyTopics: string[];
  alertHistory: AssistAlert[];
  showHistory: boolean;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  onToggleHistory: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div className="lg:col-span-2 space-y-4">
      {/* Alert panel */}
      <Card
        className={`border-[#efefef] ${dangerCount > 0 ? "border-red-200" : ""}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert
                className={`h-4 w-4 ${dangerCount > 0 ? "text-red-500" : "text-[#6b6b6b]"}`}
              />
              Live Alerts
              {alerts.length > 0 && (
                <span
                  className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold ${
                    dangerCount > 0
                      ? "bg-red-500 text-white"
                      : "bg-[#111] text-white"
                  }`}
                >
                  {alerts.length}
                </span>
              )}
            </CardTitle>
            {alerts.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-[10px] text-[#9b9b9b] hover:text-[#555] font-medium"
              >
                Clear all
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {alerts.length === 0 && !analyzing ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-300 mx-auto mb-2" />
              <p className="text-sm text-[#9b9b9b] font-medium">No alerts</p>
              <p className="text-xs text-[#c0c0c0] mt-1">
                {active
                  ? "Monitoring for compliance issues…"
                  : "Enable Active mode to start monitoring."}
              </p>
            </div>
          ) : analyzing && alerts.length === 0 ? (
            <div className="py-8 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#9b9b9b] mx-auto mb-2" />
              <p className="text-sm text-[#9b9b9b]">Analyzing transcript…</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {alerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onDismiss={onDismiss}
                  isNew={newAlertIds.has(alert.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coaching tip */}
      {coachingTip && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3.5">
          <TrendingUp className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">
              Coaching Tip
            </p>
            <p className="text-sm text-blue-900 leading-relaxed">
              {coachingTip}
            </p>
          </div>
        </div>
      )}

      {/* Key topics */}
      {keyTopics.length > 0 && (
        <Card className="border-[#efefef]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#6b6b6b] font-medium flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Key Topics Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {keyTopics.map((topic) => (
                <span
                  key={topic}
                  className="inline-flex items-center rounded-full bg-[#f0f0f0] px-2.5 py-1 text-xs font-medium text-[#555]"
                >
                  {topic}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert History */}
      {alertHistory.length > 0 && (
        <Card className="border-[#efefef]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-[#6b6b6b] font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Alert History ({alertHistory.length})
              </CardTitle>
              <button
                onClick={onToggleHistory}
                className="text-[10px] text-[#9b9b9b] hover:text-[#555] font-medium"
              >
                {showHistory ? "Hide" : "Show"}
              </button>
            </div>
          </CardHeader>
          {showHistory && (
            <CardContent className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {alertHistory.slice(0, 20).map((alert) => {
                const cfg = ALERT_CFG[alert.type];
                return (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-2 rounded-lg px-2.5 py-2 ${cfg.bg} border ${cfg.border}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 mt-1.5 ${cfg.dot}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-medium leading-snug ${cfg.text}`}
                      >
                        {alert.message}
                      </p>
                      <p className={`text-[10px] mt-0.5 ${cfg.subtext}`}>
                        {relativeTime(alert.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>
      )}

      {/* Status card — when inactive */}
      {!active && alerts.length === 0 && (
        <Card className="border-dashed border-[#e0e0e0]">
          <CardContent className="py-6 text-center space-y-3">
            <div className="h-10 w-10 rounded-full bg-[#f5f5f5] flex items-center justify-center mx-auto">
              <Zap className="h-5 w-5 text-[#c0c0c0]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#555]">
                Auto-analyze inactive
              </p>
              <p className="text-xs text-[#9b9b9b] mt-1 max-w-[200px] mx-auto">
                Enable Active mode to auto-analyze the transcript every{" "}
                {DEBOUNCE_MS / 1000}s.
              </p>
            </div>
            <Button size="sm" onClick={onToggleActive} className="gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Enable Active Mode
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
