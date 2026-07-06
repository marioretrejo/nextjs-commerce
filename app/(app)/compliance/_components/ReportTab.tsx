import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { ComplianceCheck } from "./constants";

export function ReportTab({
  score,
  dncCount,
  checks,
}: {
  score: number;
  dncCount: number;
  checks: ComplianceCheck[];
}) {
  const passing = checks.filter((c) => c.pass).length;

  return (
    <TabsContent value="report" className="space-y-4 pt-4">
      <div className="grid grid-cols-3 gap-4">
        <Card
          className={
            score >= 80
              ? "border-green-200 bg-green-50"
              : score >= 50
                ? "border-yellow-200 bg-yellow-50"
                : "border-red-200 bg-red-50"
          }
        >
          <CardContent className="pt-6 text-center">
            <p
              className={`text-4xl font-bold mb-1 ${score >= 80 ? "text-green-700" : score >= 50 ? "text-yellow-700" : "text-red-700"}`}
            >
              {score}%
            </p>
            <p className="text-sm font-medium text-[#0a0a0a]">
              Compliance Score
            </p>
            <p className="text-xs text-[#6b6b6b] mt-1">
              {score >= 80
                ? "Good standing"
                : score >= 50
                  ? "Needs improvement"
                  : "Action required"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold text-[#0a0a0a] mb-1">{dncCount}</p>
            <p className="text-sm font-medium text-[#0a0a0a]">DNC Entries</p>
            <p className="text-xs text-[#6b6b6b] mt-1">
              Numbers blocked from calling
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold text-[#0a0a0a] mb-1">
              {passing}/{checks.length}
            </p>
            <p className="text-sm font-medium text-[#0a0a0a]">Checks Passing</p>
            <p className="text-xs text-[#6b6b6b] mt-1">Compliance checklist</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Checklist</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-[#e0e0e0]">
          {checks.map(({ label, pass }) => (
            <div key={label} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {pass ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
                )}
                <span className="text-sm text-[#0a0a0a]">{label}</span>
              </div>
              <Badge
                variant={pass ? "default" : "secondary"}
                className={
                  pass ? "bg-green-100 text-green-700 border-transparent" : ""
                }
              >
                {pass ? "Pass" : "Action needed"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
