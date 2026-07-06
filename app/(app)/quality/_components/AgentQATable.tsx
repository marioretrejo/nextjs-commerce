import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AgentQARow } from "./types";
import { THRESHOLD } from "./types";

export function AgentQATable({
  loading,
  agentQARows,
}: {
  loading: boolean;
  agentQARows: AgentQARow[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Agent QA Scores</CardTitle>
        <CardDescription>Per-agent quality performance</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 bg-[#f5f5f5] rounded animate-pulse" />
            ))}
          </div>
        ) : agentQARows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#6b6b6b]">
            No QA data available.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3 px-5 py-3 border-b border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
              <span>Agent</span>
              <span className="text-right">Calls</span>
              <span className="text-right">Avg QA</span>
              <span className="text-right">Below {THRESHOLD}%</span>
            </div>
            <div className="divide-y divide-[#e0e0e0]">
              {agentQARows.map((row) => (
                <div
                  key={row.agent.id}
                  className="grid grid-cols-4 gap-3 px-5 py-3 text-sm items-center hover:bg-[#f5f5f5]"
                >
                  <span className="font-medium text-[#0a0a0a] truncate">
                    {row.agent.name}
                  </span>
                  <span className="text-right text-[#6b6b6b]">
                    {row.callCount}
                  </span>
                  <span className="text-right font-medium text-[#0a0a0a]">
                    {row.avgScore}%
                  </span>
                  <span className="text-right">
                    {row.belowThreshold > 0 ? (
                      <Badge className="bg-[#0a0a0a] text-white border-transparent text-xs">
                        {row.belowThreshold}
                      </Badge>
                    ) : (
                      <span className="text-[#6b6b6b]">0</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
