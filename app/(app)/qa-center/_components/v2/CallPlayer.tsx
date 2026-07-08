"use client";

import { useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { WaveformPlayer } from "@/components/calls/WaveformPlayer";
import { agentName, formatDuration, type QaCall } from "./types";

interface TranscriptLine {
  speaker: string;
  text: string;
  isAgent: boolean;
}

function parseTranscript(raw: string | null): TranscriptLine[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const isAgent =
        /^\S+\s*:/.test(line) &&
        !/^(user|caller|contact|cliente|customer)\s*:/i.test(line);
      const m = line.match(/^([^:]{1,30}):\s*(.*)$/);
      return {
        speaker: m ? m[1]!.trim() : isAgent ? "Agente" : "Cliente",
        text: m ? m[2]!.trim() : line,
        isAgent,
      };
    });
}

export function CallPlayer({
  call,
  loading,
}: {
  call: QaCall | null;
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const lines = useMemo(
    () => parseTranscript(call?.transcript ?? null),
    [call],
  );
  const filtered = query.trim()
    ? lines.filter((l) => l.text.toLowerCase().includes(query.toLowerCase()))
    : lines;

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-24 animate-pulse rounded-lg bg-[#f5f5f5]" />
        <div className="h-64 animate-pulse rounded-lg bg-[#f5f5f5]" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-[#6b6b6b]">
        Selecciona una llamada para revisarla.
      </div>
    );
  }

  const hasRecording = !!(call.recording_storage_path || call.recording_url);
  const recordingUrl = hasRecording ? `/api/calls/${call.id}/recording` : null;

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-[#0a0a0a]">
            {call.contact_name ?? call.contact_phone ?? "Desconocido"}
          </h2>
          <p className="mt-0.5 text-sm text-[#6b6b6b]">
            {agentName(call)}
            {call.department ? ` · ${call.department}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs text-[#6b6b6b]">
          <p>{formatDuration(call.duration_seconds)}</p>
          {call.external_source && (
            <p className="mt-0.5 uppercase tracking-wide">
              {call.external_source.replace(/_/g, " ")}
            </p>
          )}
        </div>
      </div>

      {/* Player */}
      {recordingUrl ? (
        <div className="rounded-xl border border-[#e5e5e5] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-[#0a0a0a]">
              Grabación
            </span>
            <a
              href={`${recordingUrl}?download=1`}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#e0e0e0] bg-white px-2.5 py-1 text-xs font-medium text-[#0a0a0a] transition-colors hover:bg-[#f5f5f5]"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar
            </a>
          </div>
          <WaveformPlayer
            url={recordingUrl}
            transcript={call.transcript}
            duration={call.duration_seconds}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#e5e5e5] p-4 text-center text-sm text-[#9b9b9b]">
          Sin grabación disponible.
        </div>
      )}

      {/* Transcript */}
      <div className="rounded-xl border border-[#e5e5e5]">
        <div className="flex items-center justify-between gap-3 border-b border-[#efefef] p-3">
          <span className="text-sm font-medium text-[#0a0a0a]">
            Transcripción
          </span>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9b9b9b]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en la transcripción…"
              className="h-8 w-full rounded-md border border-[#e0e0e0] bg-white pl-8 pr-2 text-xs text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
            />
          </div>
        </div>
        <div className="max-h-[420px] space-y-3 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-[#9b9b9b]">
              {call.transcript ? "Sin coincidencias." : "Sin transcripción."}
            </p>
          ) : (
            filtered.map((line, i) => (
              <div
                key={i}
                className={`flex ${line.isAgent ? "flex-row" : "flex-row-reverse"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm ${
                    line.isAgent
                      ? "bg-[#0a0a0a] text-white"
                      : "bg-[#f5f5f5] text-[#0a0a0a]"
                  }`}
                >
                  <p
                    className={`mb-1 text-[11px] font-medium ${
                      line.isAgent ? "text-[#b5b5b5]" : "text-[#6b6b6b]"
                    }`}
                  >
                    {line.isAgent ? "Agente" : "Cliente"}
                  </p>
                  {line.text}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
