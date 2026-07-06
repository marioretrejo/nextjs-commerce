"use client";

import { useState, useEffect } from "react";
import { Clock, X } from "lucide-react";
import type { AssistAlert } from "./types";
import { ALERT_CFG, relativeTime } from "./config";

export function AlertCard({
  alert,
  onDismiss,
  isNew,
}: {
  alert: AssistAlert;
  onDismiss: (id: string) => void;
  isNew: boolean;
}) {
  const cfg = ALERT_CFG[alert.type];
  const [, forceUpdate] = useState(0);

  // Re-render every 15s to update relative time
  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 15_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`rounded-xl border p-3.5 space-y-2 transition-all duration-300 ${cfg.bg} ${cfg.border} ${
        isNew
          ? "ring-2 ring-offset-1 ring-current/20 animate-in fade-in slide-in-from-top-2"
          : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {cfg.icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span
              className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.badge}`}
            >
              {cfg.label}
            </span>
            <span
              className={`text-[10px] ${cfg.subtext} flex items-center gap-1`}
            >
              <Clock className="h-2.5 w-2.5" />
              {relativeTime(alert.timestamp)}
            </span>
          </div>
          <p className={`text-sm font-medium leading-snug ${cfg.text}`}>
            {alert.message}
          </p>
        </div>
        <button
          onClick={() => onDismiss(alert.id)}
          className={`shrink-0 p-0.5 rounded ${cfg.subtext} hover:opacity-70 transition-opacity`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {alert.action_suggestion && (
        <div
          className={`rounded-lg px-2.5 py-2 text-xs leading-relaxed bg-white/60 ${cfg.text} border ${cfg.border}`}
        >
          <span className="font-semibold">Suggested action: </span>
          {alert.action_suggestion}
        </div>
      )}
    </div>
  );
}
