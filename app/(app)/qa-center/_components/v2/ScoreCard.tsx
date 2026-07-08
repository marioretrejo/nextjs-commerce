"use client";

import type { QaCall } from "./types";

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#ececec" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#0a0a0a"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-[#0a0a0a]">
          {Math.round(pct)}
        </span>
        <span className="text-xs text-[#9b9b9b]">/100</span>
      </div>
    </div>
  );
}

function CategoryBar({ name, score }: { name: string; score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="capitalize text-[#0a0a0a]">
          {name.replace(/_/g, " ")}
        </span>
        <span className="font-semibold text-[#0a0a0a]">{Math.round(pct)}/100</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#ececec]">
        <div
          className="h-full rounded-full bg-[#0a0a0a]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm text-[#0a0a0a]">
            <span className="text-[#9b9b9b]">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScoreCard({
  call,
  loading,
}: {
  call: QaCall | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="mx-auto h-32 w-32 animate-pulse rounded-full bg-[#f5f5f5]" />
        <div className="h-40 animate-pulse rounded-lg bg-[#f5f5f5]" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-[#6b6b6b]">
        Selecciona una llamada.
      </div>
    );
  }

  const details = call.qa_details;
  const breakdown = details?.scores ?? [];
  const analyzed = call.analysis_status === "analyzed" && call.qa_score != null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h3 className="text-sm font-semibold text-[#0a0a0a]">Puntaje QA</h3>
      </div>

      {analyzed ? (
        <>
          <div className="flex flex-col items-center">
            <ScoreRing score={call.qa_score ?? 0} />
            <div className="mt-3 flex items-center gap-4 text-xs text-[#6b6b6b]">
              {call.sentiment && (
                <span className="capitalize">Sentimiento: {call.sentiment}</span>
              )}
              {call.disposition && (
                <span className="capitalize">
                  {call.disposition.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>

          {breakdown.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]">
                Desglose por categoría
              </p>
              {breakdown.map((b, i) => (
                <CategoryBar key={i} name={b.name} score={b.score} />
              ))}
            </div>
          )}

          <List title="Fortalezas" items={details?.strengths ?? []} />
          <List
            title="Oportunidades de mejora"
            items={details?.opportunities ?? details?.weaknesses ?? []}
          />
          <List title="Recomendaciones" items={details?.recommendations ?? []} />

          {call.qa_feedback &&
            !details?.recommendations?.length &&
            !details?.opportunities?.length && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]">
                  Recomendaciones
                </p>
                <p className="rounded-lg bg-[#f5f5f5] px-4 py-3 text-sm text-[#0a0a0a]">
                  {call.qa_feedback}
                </p>
              </div>
            )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-[#e5e5e5] p-6 text-center text-sm text-[#6b6b6b]">
          {call.analysis_status === "processing"
            ? "Analizando la llamada…"
            : call.analysis_status === "error"
              ? "El análisis falló para esta llamada."
              : "Esta llamada aún no ha sido analizada."}
        </div>
      )}
    </div>
  );
}
