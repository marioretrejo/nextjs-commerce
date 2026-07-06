import { Card, CardContent } from "@/components/ui/card";
import { Shield, TrendingUp, AlertTriangle, Star } from "lucide-react";
import { format } from "date-fns";
import type { Call } from "@/lib/supabase/types";
import type { AgentQARow } from "./types";
import { THRESHOLD } from "./types";

export function SummaryCards({
  loading,
  avgScore,
  scoredCount,
  bestAgent,
  worstCall,
  belowThresholdCount,
}: {
  loading: boolean;
  avgScore: number;
  scoredCount: number;
  bestAgent: AgentQARow | null;
  worstCall: Call | null;
  belowThresholdCount: number;
}) {
  const cards = [
    {
      label: "Avg QA Score",
      value: loading ? "—" : `${avgScore.toFixed(1)}%`,
      icon: <Shield className="w-5 h-5 text-[#6b6b6b]" />,
      sub: `${scoredCount} scored calls`,
    },
    {
      label: "Best Agent",
      value: loading ? "—" : bestAgent ? bestAgent.agent.name : "—",
      icon: <Star className="w-5 h-5 text-[#6b6b6b]" />,
      sub: bestAgent ? `${bestAgent.avgScore}% avg` : "No data",
    },
    {
      label: "Worst Call Score",
      value: loading ? "—" : worstCall ? `${worstCall.qa_score}%` : "—",
      icon: <TrendingUp className="w-5 h-5 text-[#6b6b6b]" />,
      sub: worstCall
        ? format(new Date(worstCall.created_at), "MMM d")
        : "No data",
    },
    {
      label: `Below ${THRESHOLD}%`,
      value: loading ? "—" : belowThresholdCount.toString(),
      icon: <AlertTriangle className="w-5 h-5 text-[#6b6b6b]" />,
      sub: "Calls below threshold",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map((m) => (
        <Card key={m.label}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-[#6b6b6b]">{m.label}</p>
              {m.icon}
            </div>
            <p className="text-3xl font-bold text-[#0a0a0a]">{m.value}</p>
            <p className="text-xs text-[#6b6b6b] mt-1">{m.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
