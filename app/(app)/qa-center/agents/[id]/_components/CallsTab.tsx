import { useRouter } from "next/navigation";
import { Phone, ChevronRight } from "lucide-react";
import type { CallItem } from "./types";
import {
  RISK_COLOR,
  REVIEW_COLOR,
  ScoreBadge,
  fmtDuration,
  fmtRelative,
} from "./helpers";

export function CallsTab({
  calls,
  router,
}: {
  calls: CallItem[];
  router: ReturnType<typeof useRouter>;
}) {
  if (!calls.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Phone className="mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm">No calls recorded yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900/50">
            {[
              "Date",
              "Channel",
              "Duration",
              "Score",
              "Compliance",
              "Sales",
              "Risk",
              "Status",
              "",
            ].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left text-xs font-medium text-gray-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => (
            <tr
              key={c.id}
              onClick={() => router.push(`/qa-center/calls/${c.id}`)}
              className="cursor-pointer border-b border-gray-800/50 transition hover:bg-gray-800/40 last:border-0"
            >
              <td className="px-4 py-2.5 text-gray-300">
                {fmtRelative(c.created_at)}
              </td>
              <td className="px-4 py-2.5">
                <span className="rounded bg-gray-800 px-2 py-0.5 font-mono text-xs text-gray-400">
                  {c.channel}
                </span>
              </td>
              <td className="px-4 py-2.5 text-gray-400">
                {fmtDuration(c.duration_s)}
              </td>
              <td className="px-4 py-2.5">
                {c.overall_score != null ? (
                  <ScoreBadge score={c.overall_score} />
                ) : (
                  <span className="text-gray-600">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-xs text-gray-400">
                {c.compliance_score != null
                  ? c.compliance_score.toFixed(0)
                  : "—"}
              </td>
              <td className="px-4 py-2.5 text-xs text-gray-400">
                {c.sales_score != null ? c.sales_score.toFixed(0) : "—"}
              </td>
              <td className="px-4 py-2.5">
                {c.risk_level ? (
                  <span
                    className={`rounded px-2 py-0.5 text-xs capitalize ${RISK_COLOR[c.risk_level] ?? "text-gray-400"}`}
                  >
                    {c.risk_level}
                  </span>
                ) : (
                  <span className="text-gray-600">—</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={`rounded px-2 py-0.5 text-xs capitalize ${REVIEW_COLOR[c.review_status] ?? "text-gray-400"}`}
                >
                  {c.review_status.replace(/_/g, " ")}
                </span>
              </td>
              <td className="px-4 py-2.5">
                <ChevronRight className="h-4 w-4 text-gray-600" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
