import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Smile, Meh, Frown } from "lucide-react";
import type { SentimentCounts } from "./types";

export function SentimentBreakdown({
  loading,
  counts,
  total,
  totalCalls,
}: {
  loading: boolean;
  counts: SentimentCounts;
  total: number;
  totalCalls: number;
}) {
  const rows = [
    {
      key: "positive" as const,
      label: "Positive",
      icon: <Smile className="w-4 h-4 text-green-600" />,
      color: "bg-green-500",
    },
    {
      key: "neutral" as const,
      label: "Neutral",
      icon: <Meh className="w-4 h-4 text-yellow-600" />,
      color: "bg-yellow-400",
    },
    {
      key: "negative" as const,
      label: "Negative",
      icon: <Frown className="w-4 h-4 text-red-500" />,
      color: "bg-red-500",
    },
  ];

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Sentiment Breakdown</CardTitle>
        <CardDescription>
          AI-analyzed call sentiment from post-call intelligence
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-20 bg-[#f5f5f5] rounded animate-pulse" />
        ) : total === 0 ? (
          <p className="text-sm text-[#6b6b6b] py-4 text-center">
            No analyzed calls yet — sentiment is extracted automatically after
            each call.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map(({ key, label, icon, color }) => {
              const count = counts[key];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  {icon}
                  <span className="w-16 text-sm text-[#6b6b6b]">{label}</span>
                  <div className="flex-1 h-2 rounded-full bg-[#f5f5f5] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-sm font-medium text-[#0a0a0a]">
                    {count.toLocaleString()} ({pct}%)
                  </span>
                </div>
              );
            })}
            <p className="text-xs text-[#6b6b6b] pt-1">
              {total.toLocaleString()} of {totalCalls.toLocaleString()} calls
              analyzed
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
