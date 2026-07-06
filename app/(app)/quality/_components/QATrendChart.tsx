import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { QAWeeklyPoint } from "./types";

export function QATrendChart({
  loading,
  weeklyData,
}: {
  loading: boolean;
  weeklyData: QAWeeklyPoint[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">QA Score Trend</CardTitle>
        <CardDescription>
          Average weekly QA score (last 90 days)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-52 bg-[#f5f5f5] rounded animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={weeklyData}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#6b6b6b" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "#6b6b6b" }}
                unit="%"
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid #e0e0e0",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v}%`, "Avg QA"]}
              />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="#0a0a0a"
                strokeWidth={2}
                dot={{ fill: "#0a0a0a", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
