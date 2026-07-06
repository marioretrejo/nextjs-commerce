import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import type {
  AgentLeaderboardEntry,
  DashboardData,
  SortKey,
  SortDir,
} from "./types";
import { scoreColor, riskBg, riskLabel, ScoreCell } from "./helpers";
import { SortTh } from "./SortTh";

interface Props {
  sorted: AgentLeaderboardEntry[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  data: DashboardData | null;
}

export function RankingsTable({
  sorted,
  sortKey,
  sortDir,
  onSort,
  data,
}: Props) {
  return (
    <Card className="border-[#efefef]">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Full Rankings</CardTitle>
            <CardDescription className="mt-0.5">
              {sorted.length} agent{sorted.length !== 1 ? "s" : ""} · Click
              column headers to sort
            </CardDescription>
          </div>
          {data && (
            <div className="flex items-center gap-4 text-xs text-[#9b9b9b]">
              <span>
                <span className="font-semibold text-[#111]">
                  {data.analyzedInteractions}
                </span>{" "}
                analyzed
              </span>
              {data.complianceRate !== null && (
                <span>
                  <span
                    className={`font-semibold ${scoreColor(data.complianceRate)}`}
                  >
                    {data.complianceRate}%
                  </span>{" "}
                  compliance
                </span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 mt-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                <th className="px-4 py-2.5 text-left w-10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9b9b9b]">
                    Rank
                  </span>
                </th>
                <SortTh
                  label="Agent"
                  sortKey="name"
                  currentKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                />
                <SortTh
                  label="Calls"
                  sortKey="interactions"
                  currentKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                />
                <SortTh
                  label="Overall"
                  sortKey="avg_overall"
                  currentKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                />
                <SortTh
                  label="Compliance"
                  sortKey="avg_compliance"
                  currentKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                />
                <SortTh
                  label="Sales"
                  sortKey="avg_sales"
                  currentKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                />
                <SortTh
                  label="Soft Skills"
                  sortKey="avg_soft_skills"
                  currentKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                />
                <SortTh
                  label="Comp. Rate"
                  sortKey="compliance_rate"
                  currentKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                />
                <th className="px-4 py-2.5 text-left">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9b9b9b]">
                    Risk Level
                  </span>
                </th>
                <th className="px-4 py-2.5 text-right w-20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9b9b9b]">
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f5f5f5]">
              {sorted.map((agent, idx) => {
                const rank = idx + 1;
                const riskScore =
                  agent.avg_risk ?? Math.round(100 - agent.avg_overall);
                return (
                  <tr
                    key={agent.name}
                    className="hover:bg-[#fafafa] transition-colors"
                  >
                    {/* Rank */}
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm font-bold ${
                          rank === 1
                            ? "text-yellow-600"
                            : rank === 2
                              ? "text-gray-500"
                              : rank === 3
                                ? "text-orange-500"
                                : "text-[#9b9b9b]"
                        }`}
                      >
                        {rank === 1
                          ? "🥇"
                          : rank === 2
                            ? "🥈"
                            : rank === 3
                              ? "🥉"
                              : `#${rank}`}
                      </span>
                    </td>

                    {/* Agent name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-[#f0f0f0] flex items-center justify-center text-xs font-bold text-[#6b6b6b] shrink-0">
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-[#111] truncate max-w-[140px]">
                          {agent.name}
                        </span>
                      </div>
                    </td>

                    {/* Calls */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-[#555]">
                        {agent.interactions}
                      </span>
                    </td>

                    {/* Overall */}
                    <td className="px-4 py-3">
                      <ScoreCell score={agent.avg_overall} />
                    </td>

                    {/* Compliance score */}
                    <td className="px-4 py-3">
                      <ScoreCell score={agent.avg_compliance} />
                    </td>

                    {/* Sales */}
                    <td className="px-4 py-3">
                      <ScoreCell score={agent.avg_sales} />
                    </td>

                    {/* Soft Skills */}
                    <td className="px-4 py-3">
                      <ScoreCell score={agent.avg_soft_skills} />
                    </td>

                    {/* Compliance Rate */}
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

                    {/* Risk badge */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${riskBg(riskScore)}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            riskScore < 20
                              ? "bg-green-500"
                              : riskScore < 45
                                ? "bg-yellow-500"
                                : riskScore < 70
                                  ? "bg-orange-500"
                                  : "bg-red-500"
                          }`}
                        />
                        {riskLabel(riskScore)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[#9b9b9b] hover:text-[#111]"
                      >
                        <Link
                          href={`/qa-center?agent=${encodeURIComponent(agent.name)}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
