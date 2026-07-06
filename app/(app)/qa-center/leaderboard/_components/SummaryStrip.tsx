import { Card, CardContent } from "@/components/ui/card";
import type { DashboardData } from "./types";
import { scoreColor } from "./helpers";

interface Props {
  data: DashboardData;
}

export function SummaryStrip({ data }: Props) {
  const stats = [
    {
      value: data.analyzedInteractions,
      label: "Calls Analyzed",
      color: "text-[#111]",
    },
    {
      value: data.avgOverallScore !== null ? `${data.avgOverallScore}` : "—",
      label: "Avg QA Score",
      color:
        data.avgOverallScore !== null
          ? scoreColor(data.avgOverallScore)
          : "text-[#9b9b9b]",
    },
    {
      value: data.complianceRate !== null ? `${data.complianceRate}%` : "—",
      label: "Compliance Rate",
      color:
        data.complianceRate !== null
          ? scoreColor(data.complianceRate)
          : "text-[#9b9b9b]",
    },
    {
      value: data.flagsBySeverity.critical + data.flagsBySeverity.high,
      label: "High-Risk Flags",
      color:
        data.flagsBySeverity.critical + data.flagsBySeverity.high > 0
          ? "text-red-600"
          : "text-green-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-[#efefef]">
          <CardContent className="pt-4 pb-3">
            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-[#6b6b6b] mt-0.5">{stat.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
