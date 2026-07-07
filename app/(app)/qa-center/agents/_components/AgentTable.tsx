import { Users, Phone, Loader2, UserX, ChevronRight } from "lucide-react";
import type { Agent } from "./types";
import { ScoreBadge, TrendIcon } from "./badges";

export function AgentTable({
  filtered,
  loading,
  error,
  onView,
  onDeactivate,
  onCreate,
}: {
  filtered: Agent[];
  loading: boolean;
  error: string | null;
  onView: (id: string) => void;
  onDeactivate: (id: string, name: string) => void;
  onCreate: () => void;
}) {
  return (
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
            onClick={onCreate}
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
                        <p className="font-medium text-gray-200">
                          {agent.name}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">
                          {agent.agent_id}
                        </p>
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
                      ? new Date(
                          agent.metrics.last_call_at,
                        ).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onView(agent.id)}
                        className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs text-gray-300 transition hover:bg-gray-700"
                      >
                        View
                        <ChevronRight className="h-3 w-3" />
                      </button>
                      {agent.is_active && (
                        <button
                          onClick={() => onDeactivate(agent.id, agent.name)}
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
  );
}
