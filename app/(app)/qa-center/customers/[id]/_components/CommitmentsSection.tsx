import { CheckCircle, Clock } from "lucide-react";
import type { Commitment } from "./types";
import { formatDate } from "./format";

export function CommitmentsSection({
  commitments,
}: {
  commitments: Commitment[];
}) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="h-4 w-4 text-indigo-400" />
        <h2 className="text-sm font-semibold text-white">
          Follow-up Commitments
        </h2>
        <span className="text-xs text-gray-500">({commitments.length})</span>
      </div>
      <div className="space-y-2">
        {commitments.map((c) => (
          <div
            key={c.id}
            className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                      c.status === "fulfilled"
                        ? "bg-green-500/10 text-green-400"
                        : c.status === "missed"
                          ? "bg-red-500/10 text-red-400"
                          : c.status === "cancelled"
                            ? "bg-gray-500/10 text-gray-500"
                            : "bg-yellow-500/10 text-yellow-400"
                    }`}
                  >
                    {c.status}
                  </span>
                  <span className="text-[10px] text-gray-500 capitalize">
                    {c.committed_by}
                  </span>
                </div>
                <p className="text-sm text-gray-200">{c.commitment_text}</p>
                {c.fulfilled_at && (
                  <p className="text-[10px] text-green-400/70 mt-1.5">
                    Fulfilled {formatDate(c.fulfilled_at)}
                  </p>
                )}
                <p className="text-[10px] text-gray-600 mt-1">
                  Detected {formatDate(c.created_at)}
                </p>
              </div>
              {c.due_date && (
                <div className="shrink-0 flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  {formatDate(c.due_date)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
