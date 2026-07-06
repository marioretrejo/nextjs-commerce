import { useRouter } from "next/navigation";
import { MessageSquare, ChevronRight } from "lucide-react";
import type { CoachingItem } from "./types";
import { PRIORITY_COLOR, fmtDate } from "./helpers";

export function CoachingTab({ reports }: { reports: CoachingItem[] }) {
  const router = useRouter();

  if (!reports.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <MessageSquare className="mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm">No coaching reports yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <div
          key={r.id}
          onClick={() => router.push(`/qa-center/coaching/${r.id}`)}
          className="cursor-pointer rounded-xl border border-gray-800 bg-gray-900/50 p-4 transition hover:bg-gray-800/50"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-xs capitalize ${PRIORITY_COLOR[r.priority] ?? "text-gray-400"}`}
              >
                {r.priority}
              </span>
              <span className="text-xs text-gray-500">
                {fmtDate(r.created_at)}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-600" />
          </div>
          {r.strengths && r.strengths.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-emerald-400">Strengths</p>
              <ul className="space-y-0.5">
                {r.strengths.slice(0, 2).map((s, i) => (
                  <li key={i} className="text-xs text-gray-400">
                    · {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.improvements && r.improvements.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs text-amber-400">Areas to Improve</p>
              <ul className="space-y-0.5">
                {r.improvements.slice(0, 2).map((s, i) => (
                  <li key={i} className="text-xs text-gray-400">
                    · {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
