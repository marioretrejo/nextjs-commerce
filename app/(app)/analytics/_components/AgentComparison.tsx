import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Bot } from "lucide-react";
import type { AgentRow } from "./types";

export function AgentComparison({
  loading,
  rows,
}: {
  loading: boolean;
  rows: AgentRow[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="w-4 h-4" />
          Agent Comparison
        </CardTitle>
        <CardDescription>Performance breakdown by agent</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 bg-[#f5f5f5] rounded animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#6b6b6b]">
            No data available for the selected period.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3 px-5 py-3 border-b border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
              <span>Agent</span>
              <span className="text-right">Calls</span>
              <span className="text-right">Conversion</span>
              <span className="text-right">Avg QA</span>
            </div>
            <div className="divide-y divide-[#e0e0e0]">
              {rows.map((row) => {
                const rate =
                  row.calls > 0
                    ? ((row.converted / row.calls) * 100).toFixed(1)
                    : "0.0";
                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-4 gap-3 px-5 py-3 text-sm items-center hover:bg-[#f5f5f5]"
                  >
                    <span className="font-medium text-[#0a0a0a]">
                      {row.name}
                    </span>
                    <span className="text-right text-[#6b6b6b]">
                      {row.calls.toLocaleString()}
                    </span>
                    <span className="text-right text-[#0a0a0a] font-medium">
                      {rate}%
                    </span>
                    <span className="text-right text-[#6b6b6b]">
                      {row.avgQA > 0 ? `${row.avgQA}%` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
