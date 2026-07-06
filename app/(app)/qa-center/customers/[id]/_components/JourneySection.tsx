import { TrendingUp } from "lucide-react";
import type { JourneyEntry } from "./types";
import { formatDate, sentimentColor } from "./format";

export function JourneySection({ journey }: { journey: JourneyEntry[] }) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-indigo-400" />
        <h2 className="text-sm font-semibold text-white">Journey</h2>
        <span className="text-xs text-gray-500">
          ({journey.length} entries)
        </span>
      </div>
      <div className="space-y-2">
        {journey.map((j) => (
          <div
            key={j.id}
            className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs text-gray-500">
                #{j.sequence_number}
              </span>
              {j.sentiment_at_call && (
                <span
                  className={`text-xs capitalize ${sentimentColor(j.sentiment_at_call)}`}
                >
                  {j.sentiment_at_call}
                </span>
              )}
              <span className="text-xs text-gray-600 ml-auto">
                {formatDate(j.created_at)}
              </span>
            </div>
            {j.intent_at_call && (
              <p className="text-sm text-gray-300 mb-1.5">{j.intent_at_call}</p>
            )}
            {j.key_topics && j.key_topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {j.key_topics.map((t, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {j.unresolved_items && j.unresolved_items.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] text-red-400 font-medium mb-1">
                  Unresolved
                </p>
                <ul className="space-y-0.5">
                  {j.unresolved_items.map((u, i) => (
                    <li key={i} className="text-xs text-gray-400">
                      · {u}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
