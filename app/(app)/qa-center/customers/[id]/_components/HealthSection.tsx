import { Activity } from "lucide-react";
import type { CustomerScores } from "./types";
import { healthColor, riskColor, trendIcon, trendColor } from "./format";

export function HealthSection({
  scores,
  totalCalls,
}: {
  scores: CustomerScores;
  totalCalls: number;
}) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-indigo-400" />
        <h2 className="text-sm font-semibold text-white">Customer Health</h2>
        <span className="text-xs text-gray-500">
          based on {totalCalls} call{totalCalls !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Health Score */}
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
            Health Score
          </p>
          <p
            className={`text-2xl font-bold ${healthColor(scores.health_score)}`}
          >
            {scores.health_score}
            <span className="text-sm font-normal text-gray-500">/100</span>
          </p>
        </div>

        {/* Call Quality */}
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
            Call Quality
          </p>
          {scores.call_quality_score != null ? (
            <p
              className={`text-2xl font-bold ${healthColor(scores.call_quality_score)}`}
            >
              {scores.call_quality_score}
              <span className="text-sm font-normal text-gray-500">/100</span>
            </p>
          ) : (
            <p className="text-sm text-gray-600">No evaluations</p>
          )}
        </div>

        {/* Engagement */}
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
            Engagement
          </p>
          <p
            className={`text-2xl font-bold ${healthColor(scores.engagement_score)}`}
          >
            {scores.engagement_score}
            <span className="text-sm font-normal text-gray-500">/100</span>
          </p>
        </div>

        {/* Sentiment Trend */}
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
            Sentiment Trend
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            {trendIcon(scores.sentiment_trend)}
            <p
              className={`text-sm font-semibold capitalize ${trendColor(scores.sentiment_trend)}`}
            >
              {scores.sentiment_trend}
            </p>
          </div>
        </div>

        {/* Risk Level */}
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
            Risk Level
          </p>
          <p
            className={`text-sm font-bold capitalize ${riskColor(scores.customer_risk)}`}
          >
            {scores.customer_risk}
          </p>
        </div>

        {/* Unresolved Pressure */}
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
            Open Items
          </p>
          <p
            className={`text-2xl font-bold ${scores.unresolved_pressure > 50 ? "text-red-400" : scores.unresolved_pressure > 20 ? "text-yellow-400" : "text-green-400"}`}
          >
            {scores.unresolved_pressure}
            <span className="text-sm font-normal text-gray-500">/100</span>
          </p>
        </div>
      </div>
    </section>
  );
}
