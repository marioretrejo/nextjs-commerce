"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Search } from "lucide-react";
import type { Agent } from "./_components/types";
import { AgentTable } from "./_components/AgentTable";
import { CreateAgentModal } from "./_components/CreateAgentModal";

export default function AgentProfilesPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (showInactive) params.set("active", "false");
      const res = await fetch(`/api/qac/agents?${params}`);
      if (!res.ok) throw new Error("Failed to load agents");
      const data: Agent[] = await res.json();
      setAgents(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.agent_id.toLowerCase().includes(search.toLowerCase()) ||
      (a.team ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  async function handleDeactivate(agentId: string, name: string) {
    if (
      !confirm(
        `Deactivate agent "${name}"? They will no longer appear in active lists.`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/qac/agents/${agentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to deactivate");
      void fetchAgents();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to deactivate agent");
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">
                Agent Profiles
              </h1>
              <p className="text-sm text-gray-400">
                {agents.filter((a) => a.is_active).length} active agents
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            New Agent
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="border-b border-gray-800 bg-gray-900/30 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents…"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 py-1.5 pl-9 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-blue-500"
            />
            Show inactive
          </label>
        </div>
      </div>

      {/* Table */}
      <AgentTable
        filtered={filtered}
        loading={loading}
        error={error}
        onView={(id) => router.push(`/qa-center/agents/${id}`)}
        onDeactivate={(id, name) => void handleDeactivate(id, name)}
        onCreate={() => setShowCreateModal(true)}
      />

      {/* Create Modal */}
      <CreateAgentModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={fetchAgents}
      />
    </div>
  );
}
