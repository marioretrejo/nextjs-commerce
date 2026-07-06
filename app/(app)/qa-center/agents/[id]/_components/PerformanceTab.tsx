import { Activity } from "lucide-react";
import type { AgentProfile } from "./types";
import { ScoreBadge, Sparkline, fmtDate } from "./helpers";

export function PerformanceTab({ profile }: { profile: AgentProfile }) {
  const m = profile.metrics;
  const trend = profile.score_trend;

  return (
    <div className="space-y-6">
      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Avg Overall", value: m.avg_score, suffix: "" },
          { label: "Avg Compliance", value: m.avg_compliance, suffix: "" },
          { label: "Avg Sales", value: m.avg_sales, suffix: "" },
          { label: "Avg Soft Skills", value: m.avg_soft_skills, suffix: "" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-800 bg-gray-900/50 p-4"
          >
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {value > 0 ? value.toFixed(1) : "—"}
            </p>
          </div>
        ))}
      </div>

      {/* Score trend table */}
      {trend.length > 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50">
          <div className="border-b border-gray-800 px-5 py-3">
            <h3 className="text-sm font-medium text-gray-300">
              Score Trend
              <span className="ml-2 text-xs font-normal text-gray-500">
                ({trend.length} evaluated calls)
              </span>
            </h3>
          </div>
          <div className="p-5">
            <Sparkline data={trend} />
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900">
                <tr className="border-b border-gray-800">
                  <th className="px-5 py-2 text-left text-xs font-medium text-gray-500">
                    Date
                  </th>
                  <th className="px-5 py-2 text-right text-xs font-medium text-gray-500">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...trend].reverse().map((d, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-800/50 last:border-0"
                  >
                    <td className="px-5 py-2 text-gray-400">
                      {fmtDate(d.date)}
                    </td>
                    <td className="px-5 py-2 text-right">
                      <ScoreBadge score={d.score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Activity className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">No evaluated calls yet</p>
        </div>
      )}

      {/* Risk distribution */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h3 className="mb-3 text-sm font-medium text-gray-300">
          Avg Risk Score
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-full bg-gray-800">
            <div
              className="h-3 rounded-full bg-amber-500 transition-all"
              style={{ width: `${Math.min(100, m.avg_risk)}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-gray-200">
            {m.avg_risk > 0 ? m.avg_risk.toFixed(1) : "—"}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-600">
          Lower is better — higher risk means more escalations
        </p>
      </div>
    </div>
  );
}
