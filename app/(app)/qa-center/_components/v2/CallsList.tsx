"use client";

import { format } from "date-fns";
import { agentName, formatDuration, type QaCall } from "./types";

function ScoreDot({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e5e5e5] text-[11px] text-[#9b9b9b]">
        —
      </div>
    );
  }
  const r = 15;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="relative h-9 w-9 shrink-0">
      <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="#ececec"
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="#0a0a0a"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-[#0a0a0a]">
        {Math.round(pct)}
      </span>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  analyzed: "Analizada",
  processing: "Analizando…",
  pending: "Pendiente",
  error: "Error",
};

export function CallsList({
  calls,
  selectedId,
  onSelect,
  loading,
}: {
  calls: QaCall[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-[#f5f5f5]" />
        ))}
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-[#6b6b6b]">
        No hay llamadas todavía.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[#efefef]">
      {calls.map((call) => {
        const selected = call.id === selectedId;
        return (
          <li key={call.id}>
            <button
              type="button"
              onClick={() => onSelect(call.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                selected ? "bg-[#f5f5f5]" : "hover:bg-[#fafafa]"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium text-[#0a0a0a]">
                    {call.contact_name ?? call.contact_phone ?? "Desconocido"}
                  </p>
                  {call.qa_journey_id && (
                    <span
                      title="Parte de una secuencia"
                      className="rounded border border-[#e5e5e5] px-1 text-[9px] uppercase tracking-wide text-[#6b6b6b]"
                    >
                      journey
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-[#6b6b6b]">
                  {agentName(call)}
                  {call.department ? ` · ${call.department}` : ""}
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-[11px] text-[#9b9b9b]">
                  <span>{formatDuration(call.duration_seconds)}</span>
                  <span>·</span>
                  <span>
                    {format(new Date(call.created_at), "d MMM, HH:mm")}
                  </span>
                  {call.analysis_status && (
                    <>
                      <span>·</span>
                      <span>
                        {STATUS_LABEL[call.analysis_status] ??
                          call.analysis_status}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <ScoreDot score={call.qa_score} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
