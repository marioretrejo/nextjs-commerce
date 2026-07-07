import { CheckCircle, AlertCircle } from "lucide-react";
import type { CoachingDetail, Evaluation } from "./types";

export function CoachingSections({
  report,
  evaluation,
}: {
  report: CoachingDetail;
  evaluation: Evaluation | undefined;
}) {
  return (
    <>
      {/* Coaching Plan */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h2 className="mb-3 text-sm font-medium text-gray-400">
          Coaching Plan
        </h2>
        {report.coaching_plan ? (
          <p className="text-sm leading-relaxed text-gray-300">
            {report.coaching_plan}
          </p>
        ) : (
          <p className="text-sm text-gray-600">No coaching plan available.</p>
        )}
      </div>

      {/* Coaching Summary from Evaluation */}
      {evaluation?.coaching_summary && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
          <h2 className="mb-3 text-sm font-medium text-indigo-400">
            AI Coaching Notes
          </h2>
          <p className="text-sm leading-relaxed text-gray-300">
            {evaluation.coaching_summary}
          </p>
        </div>
      )}

      {/* Strengths */}
      {report.strengths && report.strengths.length > 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-400">
            <CheckCircle className="h-4 w-4" />
            Strengths
          </h2>
          <ul className="space-y-2">
            {report.strengths.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-gray-300"
              >
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weaknesses */}
      {report.weaknesses && report.weaknesses.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-400">
            <AlertCircle className="h-4 w-4" />
            Areas to Improve
          </h2>
          <ul className="space-y-2">
            {report.weaknesses.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-gray-300"
              >
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended Training */}
      {report.recommended_training &&
        report.recommended_training.length > 0 && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
            <h2 className="mb-3 text-sm font-medium text-blue-400">
              Recommended Training
            </h2>
            <ul className="space-y-2">
              {report.recommended_training.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-300"
                >
                  <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-blue-400/40 text-xs text-blue-400">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

      {/* Evaluation Summary */}
      {evaluation?.summary && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h2 className="mb-3 text-sm font-medium text-gray-400">
            Evaluation Summary
          </h2>
          <p className="text-sm leading-relaxed text-gray-400">
            {evaluation.summary}
          </p>
        </div>
      )}
    </>
  );
}
