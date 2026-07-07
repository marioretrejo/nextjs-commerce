import { ChevronRight, Clock, User, Star, Shield } from "lucide-react";
import type { Interaction, Evaluation } from "./types";
import {
  RISK_COLOR,
  REVIEW_COLOR,
  fmtDuration,
  fmtDate,
  ScoreBadge,
} from "./helpers";

export function RelatedCallCard({
  interaction,
  evaluation,
  onViewCall,
}: {
  interaction: Interaction;
  evaluation: Evaluation | undefined;
  onViewCall: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
      <h2 className="mb-3 text-sm font-medium text-gray-400">Related Call</h2>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded bg-gray-800 px-2 py-0.5 font-mono text-xs text-gray-400">
          {interaction.channel}
        </span>
        {interaction.risk_level && (
          <span
            className={`rounded px-2 py-0.5 text-xs capitalize ${RISK_COLOR[interaction.risk_level] ?? "text-gray-400"}`}
          >
            {interaction.risk_level} risk
          </span>
        )}
        <span
          className={`rounded px-2 py-0.5 text-xs capitalize ${REVIEW_COLOR[interaction.review_status] ?? "text-gray-400"}`}
        >
          {interaction.review_status.replace(/_/g, " ")}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          {fmtDuration(interaction.duration_s)}
        </span>
        <span className="text-xs text-gray-500">
          {fmtDate(interaction.created_at)}
        </span>
        {interaction.customer_name && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <User className="h-3 w-3" />
            {interaction.customer_name}
          </span>
        )}
        <button
          onClick={() => onViewCall(interaction.id)}
          className="ml-auto flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
        >
          View Call <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {evaluation && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Overall", score: evaluation.overall_score, icon: Star },
            {
              label: "Compliance",
              score: evaluation.compliance_score,
              icon: Shield,
            },
            { label: "Sales", score: evaluation.sales_score, icon: Star },
            {
              label: "Soft Skills",
              score: evaluation.soft_skills_score,
              icon: Star,
            },
          ].map(({ label, score }) => (
            <div key={label} className="rounded-lg bg-gray-800/50 px-3 py-2">
              <p className="text-xs text-gray-500">{label}</p>
              <div className="mt-1">
                {score != null ? (
                  <ScoreBadge score={score} />
                ) : (
                  <span className="text-xs text-gray-600">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
