import { Zap } from "lucide-react";
import type { Insight } from "./types";
import { formatDate } from "./format";

export function InsightsSection({ insights }: { insights: Insight[] }) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-indigo-400" />
        <h2 className="text-sm font-semibold text-white">Active Insights</h2>
        <span className="text-xs text-gray-500">({insights.length})</span>
      </div>
      <div className="space-y-2">
        {insights.map((ins) => (
          <div
            key={ins.id}
            className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {ins.insight_type && (
                  <p className="text-[10px] font-medium uppercase tracking-wider text-indigo-400 mb-1">
                    {ins.insight_type.replace(/_/g, " ")}
                  </p>
                )}
                <p className="text-sm text-gray-200">{ins.content}</p>
              </div>
              {ins.confidence != null && (
                <span className="shrink-0 text-xs text-gray-500 whitespace-nowrap">
                  {Math.round(ins.confidence * 100)}% confidence
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-600 mt-2">
              Generated {formatDate(ins.generated_at)}
              {ins.expires_at ? ` · Expires ${formatDate(ins.expires_at)}` : ""}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
