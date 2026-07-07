import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import type { DailyBar, WeeklyLine } from "./types";

export function CallsCharts({
  loading,
  dailyData,
  weeklyData,
}: {
  loading: boolean;
  dailyData: DailyBar[];
  weeklyData: WeeklyLine[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      {/* Bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Calls per Day</CardTitle>
          <CardDescription>Total calls made each day</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-52 bg-[#f5f5f5] rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={dailyData}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#6b6b6b" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6b6b6b" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #e0e0e0",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="calls" fill="#0a0a0a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Line chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Conversion Rate per Week</CardTitle>
          <CardDescription>Weekly conversion trend (%)</CardDescription>
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
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: "#6b6b6b" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#6b6b6b" }} unit="%" />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #e0e0e0",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v}%`, "Rate"]}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
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
    </div>
  );
}
