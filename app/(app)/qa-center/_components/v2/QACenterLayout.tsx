"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CallsList } from "./CallsList";
import { CallPlayer } from "./CallPlayer";
import { ScoreCard } from "./ScoreCard";
import { agentName, type QaCall } from "./types";

interface Props {
  selectedCallId: string | null;
  onSelectCall: (callId: string) => void;
}

export function QACenterLayout({ selectedCallId, onSelectCall }: Props) {
  const [calls, setCalls] = useState<QaCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const wsRes = await fetch("/api/admin/workspace-id");
      const { workspace_id } = (await wsRes.json().catch(() => ({}))) as {
        workspace_id?: string;
      };
      if (!workspace_id) {
        setCalls([]);
        return;
      }
      const res = await fetch(
        `/api/calls?workspace_id=${workspace_id}&limit=100`,
      );
      if (res.ok) {
        const data = (await res.json()) as { data?: QaCall[] };
        const rows = data.data ?? [];
        setCalls(rows);
        if (rows.length > 0 && !selectedCallId) onSelectCall(rows[0]!.id);
      }
    } catch (err) {
      console.error("[qa-center] load failed:", err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return calls;
    return calls.filter(
      (c) =>
        c.contact_name?.toLowerCase().includes(q) ||
        c.contact_phone?.toLowerCase().includes(q) ||
        agentName(c).toLowerCase().includes(q) ||
        c.department?.toLowerCase().includes(q) ||
        c.transcript?.toLowerCase().includes(q),
    );
  }, [calls, query]);

  const selectedCall =
    filtered.find((c) => c.id === selectedCallId) ??
    calls.find((c) => c.id === selectedCallId) ??
    null;

  return (
    <div className="flex h-[calc(100vh-1px)] flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center gap-4 border-b border-[#e5e5e5] px-6 py-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-[#0a0a0a]">
            QA Center
          </h1>
        </div>
        <div className="relative ml-2 max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9b9b9b]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar llamadas, agentes, clientes…"
            className="h-9 w-full rounded-md border border-[#e0e0e0] bg-white pl-9 pr-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
          />
        </div>
        <span className="ml-auto text-sm text-[#6b6b6b]">
          <span className="font-semibold text-[#0a0a0a]">
            {filtered.length}
          </span>{" "}
          llamadas
        </span>
      </div>

      {/* 3 panels */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 shrink-0 overflow-y-auto border-r border-[#e5e5e5]">
          <div className="border-b border-[#efefef] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]">
            Llamadas recientes
          </div>
          <CallsList
            calls={filtered}
            selectedId={selectedCall?.id ?? null}
            onSelect={onSelectCall}
            loading={loading}
          />
        </div>

        <div className="flex-1 overflow-y-auto border-r border-[#e5e5e5]">
          <CallPlayer call={selectedCall} loading={loading} />
        </div>

        <div className="w-96 shrink-0 overflow-y-auto">
          <ScoreCard call={selectedCall} loading={loading} />
        </div>
      </div>
    </div>
  );
}
