import {
  Phone,
  Star,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import type { AgentProfile } from "./types";
import { TrendIcon, Sparkline, fmtRelative } from "./helpers";

export function OverviewTab({ profile }: { profile: AgentProfile }) {
  const m = profile.metrics;
  const stats = [
    { label: "Total Calls", value: m.call_count.toString(), icon: Phone },
    {
      label: "Avg Score",
      value: m.avg_score > 0 ? m.avg_score.toFixed(1) : "—",
      icon: Star,
    },
    {
      label: "Compliance",
      value: m.avg_compliance > 0 ? m.avg_compliance.toFixed(1) : "—",
      icon: Shield,
    },
    {
      label: "Trend",
      value: m.improvement_trend,
      icon:
        m.improvement_trend === "up"
          ? TrendingUp
          : m.improvement_trend === "down"
            ? TrendingDown
            : Minus,
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-800 bg-gray-900/50 p-4"
          >
            <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <p className="text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Profile info */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h3 className="mb-4 text-sm font-medium text-gray-300">Profile Info</h3>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          {[
            { label: "Agent ID", value: profile.agent_id },
            { label: "Team", value: profile.team ?? "—" },
            { label: "Role", value: profile.role ?? "—" },
            { label: "Email", value: profile.email ?? "—" },
            {
              label: "Hire Date",
              value: profile.hire_date
                ? new Date(profile.hire_date).toLocaleDateString()
                : "—",
            },
            {
              label: "Last Call",
              value: m.last_call_at ? fmtRelative(m.last_call_at) : "Never",
            },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className="mt-0.5 text-sm text-gray-200">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Score breakdown */}
      {m.avg_score > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="mb-4 text-sm font-medium text-gray-300">
            Score Breakdown
          </h3>
          <div className="space-y-3">
            {[
              {
                label: "Compliance",
                value: m.avg_compliance,
                color: "bg-blue-500",
              },
              { label: "Sales", value: m.avg_sales, color: "bg-emerald-500" },
              {
                label: "Soft Skills",
                value: m.avg_soft_skills,
                color: "bg-purple-500",
              },
              { label: "Overall", value: m.avg_score, color: "bg-indigo-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-24 flex-shrink-0 text-xs text-gray-400">
                  {label}
                </span>
                <div className="flex-1 rounded-full bg-gray-800">
                  <div
                    className={`h-2 rounded-full ${color} transition-all`}
                    style={{ width: `${Math.min(100, value)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs text-gray-300">
                  {value > 0 ? value.toFixed(0) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score trend mini preview */}
      {profile.score_trend.length >= 2 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-300">Score Trend</h3>
            <TrendIcon trend={m.improvement_trend} />
          </div>
          <div className="mt-3">
            <Sparkline data={profile.score_trend} />
          </div>
          <p className="mt-1 text-xs text-gray-600">
            {profile.score_trend.length} evaluated calls
          </p>
        </div>
      )}
    </div>
  );
}
