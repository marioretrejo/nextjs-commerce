import {
  Shield,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
} from "lucide-react";
import {
  type AuditLog,
  ACTION_LABELS,
  ACTION_ICONS,
  ACTION_COLORS,
  formatRelativeTime,
  formatDetails,
} from "./config";

export function AuditTimeline({
  logs,
  loading,
  error,
  page,
  pages,
  total,
  onPrev,
  onNext,
}: {
  logs: AuditLog[];
  loading: boolean;
  error: string | null;
  page: number;
  pages: number;
  total: number;
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
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Shield className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">No audit events found</p>
        </div>
      ) : (
        <>
          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gray-800" />
            <div className="space-y-1">
              {logs.map((log) => {
                const colorClass =
                  ACTION_COLORS[log.action] ?? "text-gray-400 bg-gray-700/50";
                const detail = formatDetails(log);
                return (
                  <div
                    key={log.id}
                    className="relative flex items-start gap-4 rounded-lg px-2 py-2.5 transition hover:bg-gray-800/40"
                  >
                    {/* Timeline dot */}
                    <div
                      className={`relative z-10 flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full border border-gray-700 ${colorClass}`}
                    >
                      {ACTION_ICONS[log.action] ?? (
                        <Clock className="h-3.5 w-3.5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-gray-200">
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                        <span className="flex-shrink-0 text-xs text-gray-500">
                          {formatRelativeTime(log.created_at)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-gray-400">
                          {log.entity_type}
                        </span>
                        {log.entity_id && (
                          <span className="font-mono text-gray-600">
                            {log.entity_id.slice(0, 8)}…
                          </span>
                        )}
                        {log.user_id && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {log.user_id.slice(0, 8)}…
                          </span>
                        )}
                        {detail && (
                          <span className="text-gray-400">{detail}</span>
                        )}
                        {log.ip_address && (
                          <span className="text-gray-600">
                            {log.ip_address}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-gray-800 pt-4">
              <p className="text-sm text-gray-500">
                Page {page} of {pages} — {total.toLocaleString()} total events
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
