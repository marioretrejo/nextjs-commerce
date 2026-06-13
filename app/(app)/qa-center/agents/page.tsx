"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Phone,
  Star,
  X,
  Loader2,
  UserX,
  ChevronRight,
} from "lucide-react";

interface AgentMetrics {
  call_count: number;
  avg_score: number;
  avg_compliance: number;
  avg_sales: number;
  avg_soft_skills: number;
  avg_risk: number;
  last_call_at: string | null;
  improvement_trend: "up" | "down" | "stable";
}

interface Agent {
  id: string;
  agent_id: string;
  name: string;
  email: string | null;
  team: string | null;
  role: string | null;
  hire_date: string | null;
  is_active: boolean;
  created_at: string;
  metrics: AgentMetrics;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-emerald-400 bg-emerald-400/10"
      : score >= 65
        ? "text-amber-400 bg-amber-400/10"
        : "text-red-400 bg-red-400/10";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {score}
    </span>
  );
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up")
    return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (trend === "down")
    return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-gray-500" />;
}

interface CreateAgentForm {
  agent_id: string;
  name: string;
  email: string;
  team: string;
  role: string;
  hire_date: string;
}

export default function AgentProfilesPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateAgentForm>({
    agent_id: "",
    name: "",
    email: "",
    team: "",
    role: "",
    hire_date: "",
  });

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

  useEffect(() => { void fetchAgents(); }, [fetchAgents]);

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.agent_id.toLowerCase().includes(search.toLowerCase()) ||
      (a.team ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/qac/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: form.agent_id,
          name: form.name,
          email: form.email || undefined,
          team: form.team || undefined,
          role: form.role || undefined,
          hire_date: form.hire_date || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to create agent");
      }
      setShowCreateModal(false);
      setForm({ agent_id: "", name: "", email: "", team: "", role: "", hire_date: "" });
      void fetchAgents();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeactivate(agentId: string, name: string) {
    if (!confirm(`Deactivate agent "${name}"? They will no longer appear in active lists.`)) return;
    try {
      const res = await fetch(`/api/qac/agents/${agentId}`, { method: "DELETE" });
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
              <h1 className="text-lg font-semibold text-white">Agent Profiles</h1>
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
      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Users className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">No agents found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-3 text-sm text-blue-400 hover:text-blue-300"
            >
              Create first agent →
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/60 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3 text-left">Agent</th>
                  <th className="px-4 py-3 text-left">Team / Role</th>
                  <th className="px-4 py-3 text-center">Calls</th>
                  <th className="px-4 py-3 text-center">Avg Score</th>
                  <th className="px-4 py-3 text-center">Compliance</th>
                  <th className="px-4 py-3 text-center">Sales</th>
                  <th className="px-4 py-3 text-center">Trend</th>
                  <th className="px-4 py-3 text-center">Last Call</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filtered.map((agent) => (
                  <tr
                    key={agent.id}
                    className={`transition hover:bg-gray-800/30 ${!agent.is_active ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-sm font-medium text-blue-400">
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-200">{agent.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{agent.agent_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      <span>{agent.team ?? "—"}</span>
                      {agent.role && (
                        <span className="ml-1 text-gray-600">· {agent.role}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center justify-center gap-1 text-gray-300">
                        <Phone className="h-3.5 w-3.5 text-gray-500" />
                        {agent.metrics.call_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {agent.metrics.call_count > 0 ? (
                        <ScoreBadge score={agent.metrics.avg_score} />
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {agent.metrics.avg_compliance > 0 ? (
                        <ScoreBadge score={agent.metrics.avg_compliance} />
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {agent.metrics.avg_sales > 0 ? (
                        <ScoreBadge score={agent.metrics.avg_sales} />
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <TrendIcon trend={agent.metrics.improvement_trend} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {agent.metrics.last_call_at
                        ? new Date(agent.metrics.last_call_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => router.push(`/qa-center/agents/${agent.id}`)}
                          className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs text-gray-300 transition hover:bg-gray-700"
                        >
                          View
                          <ChevronRight className="h-3 w-3" />
                        </button>
                        {agent.is_active && (
                          <button
                            onClick={() => void handleDeactivate(agent.id, agent.name)}
                            className="rounded-lg border border-gray-700 bg-gray-800 p-1 text-gray-500 transition hover:bg-red-900/20 hover:text-red-400"
                            title="Deactivate"
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">New Agent Profile</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {createError}
              </div>
            )}

            <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">
                    Agent ID <span className="text-red-400">*</span>
                  </label>
                  <input
                    required
                    value={form.agent_id}
                    onChange={(e) => setForm({ ...form, agent_id: e.target.value })}
                    placeholder="EMP-001"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="María García"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="maria@company.com"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">Team</label>
                  <input
                    value={form.team}
                    onChange={(e) => setForm({ ...form, team: e.target.value })}
                    placeholder="Sales"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">Role</label>
                  <input
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="Sales Agent"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">Hire Date</label>
                <input
                  type="date"
                  value={form.hire_date}
                  onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                >
                  {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
