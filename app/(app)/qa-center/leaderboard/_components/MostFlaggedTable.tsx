import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { AlertTriangle, TrendingDown, TrendingUp, User } from "lucide-react";
import type { AgentLeaderboardEntry } from "./types";

interface Props {
  mostFlagged: AgentLeaderboardEntry[];
}

export function MostFlaggedTable({ mostFlagged }: Props) {
  return (
    <Card className="border-[#efefef]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <CardTitle className="text-base">Most Flagged Agents</CardTitle>
        </div>
        <CardDescription>
          Agents with the highest number of compliance and quality violations
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                {[
                  "Agent",
                  "Total Violations",
                  "Critical",
                  "High",
                  "Compliance Rate",
                  "Trend",
                ].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#9b9b9b]">
                      {h}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f5f5f5]">
              {mostFlagged
                .filter((a) => a.total_flags > 0)
                .map((agent) => (
                  <tr
                    key={agent.name}
                    className="hover:bg-[#fafafa] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-[#9b9b9b]" />
                        <span className="text-sm font-medium text-[#111]">
                          {agent.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm font-bold ${
                          agent.total_flags > 10
                            ? "text-red-600"
                            : agent.total_flags > 5
                              ? "text-orange-600"
                              : "text-[#555]"
                        }`}
                      >
                        {agent.total_flags}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {agent.critical_flags > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          {agent.critical_flags}
                        </span>
                      ) : (
                        <span className="text-xs text-[#c0c0c0]">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {agent.high_flags > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                          {agent.high_flags}
                        </span>
                      ) : (
                        <span className="text-xs text-[#c0c0c0]">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm font-semibold ${
                          agent.compliance_rate >= 80
                            ? "text-green-600"
                            : agent.compliance_rate >= 60
                              ? "text-yellow-600"
                              : "text-red-600"
                        }`}
                      >
                        {Math.round(agent.compliance_rate)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {agent.compliance_rate >= 80 ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <TrendingUp className="h-3.5 w-3.5" /> Good
                        </span>
                      ) : agent.compliance_rate >= 60 ? (
                        <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                          <TrendingDown className="h-3.5 w-3.5" /> Review
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" /> Urgent
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
