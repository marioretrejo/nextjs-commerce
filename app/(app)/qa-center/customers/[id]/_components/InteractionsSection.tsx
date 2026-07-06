import Link from "next/link";
import { Calendar, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Interaction } from "./types";
import { formatDate, formatDuration, riskBadgeVariant } from "./format";

export function InteractionsSection({
  interactions,
}: {
  interactions: Interaction[];
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-indigo-400" />
        <h2 className="text-sm font-semibold text-white">
          Recent Interactions
        </h2>
        <span className="text-xs text-gray-500">({interactions.length})</span>
      </div>
      {interactions.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-8 text-center">
          <p className="text-sm text-gray-500">No interactions linked yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {interactions.map((ix) => {
            const score = ix.qac_evaluations?.[0]?.overall_score ?? null;
            return (
              <Link
                key={ix.id}
                href={`/qa-center/calls/${ix.id}`}
                className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3 hover:bg-gray-900 hover:border-gray-700 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">
                      {ix.agent_name ?? "Unknown agent"}
                    </p>
                    {ix.channel && (
                      <span className="text-xs text-gray-500 capitalize">
                        {ix.channel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Calendar className="h-3 w-3 text-gray-600" />
                    <span className="text-xs text-gray-500">
                      {formatDate(ix.created_at)}
                    </span>
                    {ix.duration_s != null && (
                      <span className="text-xs text-gray-600">
                        {formatDuration(ix.duration_s)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ix.risk_level && ix.risk_level !== "low" && (
                    <Badge
                      variant={riskBadgeVariant(ix.risk_level)}
                      className="text-[10px] capitalize"
                    >
                      {ix.risk_level}
                    </Badge>
                  )}
                  {score != null && (
                    <span
                      className={`text-sm font-bold ${
                        score >= 80
                          ? "text-green-400"
                          : score >= 60
                            ? "text-yellow-400"
                            : "text-red-400"
                      }`}
                    >
                      {score}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
