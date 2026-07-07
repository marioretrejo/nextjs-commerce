import {
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ArrowRight,
  Loader2,
  Phone,
  Clock,
} from "lucide-react";
import {
  type CoachingReport,
  PRIORITY_COLOR,
  RISK_COLOR,
  priorityLabel,
  fmtRelative,
} from "./config";

export function ReportsList({
  reports,
  loading,
  error,
  page,
  pages,
  total,
  onOpen,
  onPrev,
  onNext,
}: {
  reports: CoachingReport[];
  loading: boolean;
  error: string | null;
  page: number;
  pages: number;
  total: number;
  onOpen: (id: string) => void;
  onPrev: () => void;
  onNext: () => void;
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
          <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <MessageSquare className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">No coaching reports found</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {reports.map((r) => (
              <div
                key={r.id}
                onClick={() => onOpen(r.id)}
                className="cursor-pointer rounded-xl border border-gray-800 bg-gray-900/50 p-5 transition hover:bg-gray-800/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Top row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded border px-2 py-0.5 text-xs capitalize ${PRIORITY_COLOR[priorityLabel(r.priority_score)] ?? "text-gray-400 bg-gray-700/50 border-gray-700"}`}
                      >
                        {priorityLabel(r.priority_score)}
                      </span>
                      {r.qac_interactions?.agent_name && (
                        <span className="text-sm font-medium text-gray-200">
                          {r.qac_interactions.agent_name}
                        </span>
                      )}
                      {r.qac_interactions?.risk_level && (
                        <span
                          className={`rounded px-2 py-0.5 text-xs capitalize ${RISK_COLOR[r.qac_interactions.risk_level] ?? "text-gray-400"}`}
                        >
                          {r.qac_interactions.risk_level} risk
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {fmtRelative(r.created_at)}
                      </span>
                      {r.qac_interactions && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="h-3 w-3" />
                          {r.qac_interactions.channel}
                        </span>
                      )}
                    </div>

                    {/* Coaching plan */}
                    {r.coaching_plan && (
                      <p className="mt-2 text-sm text-gray-400 line-clamp-2">
                        {r.coaching_plan}
                      </p>
                    )}

                    {/* Strengths / Improvements */}
                    <div className="mt-3 flex flex-wrap gap-4">
                      {r.strengths && r.strengths.length > 0 && (
                        <div>
                          <p className="mb-1 text-xs text-emerald-400">
                            Strengths
                          </p>
                          <ul className="space-y-0.5">
                            {r.strengths.slice(0, 2).map((s, i) => (
                              <li key={i} className="text-xs text-gray-500">
                                · {s}
                              </li>
                            ))}
                            {r.strengths.length > 2 && (
                              <li className="text-xs text-gray-600">
                                +{r.strengths.length - 2} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                      {r.weaknesses && r.weaknesses.length > 0 && (
                        <div>
                          <p className="mb-1 text-xs text-amber-400">
                            Weaknesses
                          </p>
                          <ul className="space-y-0.5">
                            {r.weaknesses.slice(0, 2).map((s, i) => (
                              <li key={i} className="text-xs text-gray-500">
                                · {s}
                              </li>
                            ))}
                            {r.weaknesses.length > 2 && (
                              <li className="text-xs text-gray-600">
                                +{r.weaknesses.length - 2} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-600 mt-1" />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-gray-800 pt-4">
              <p className="text-sm text-gray-500">
                Page {page} of {pages} — {total.toLocaleString()} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={onPrev}
                  className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 disabled:opacity-40 hover:bg-gray-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </button>
                <button
                  disabled={page === pages}
                  onClick={onNext}
                  className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 disabled:opacity-40 hover:bg-gray-700"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
