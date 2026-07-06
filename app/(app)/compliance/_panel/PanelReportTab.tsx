import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { useCompliance } from "../_components/useCompliance";

export function PanelReportTab({ c }: { c: ReturnType<typeof useCompliance> }) {
  const { score, checks, dncEntries } = c;
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
            <p className="text-sm font-medium">Compliance Score</p>
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
            <p className="text-4xl font-bold mb-1">{dncEntries.length}</p>
            <p className="text-sm font-medium">DNC Entries</p>
            <p className="text-xs text-[#6b6b6b] mt-1">Numbers blocked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold mb-1">
              {checks.filter((ch) => ch.pass).length}/{checks.length}
            </p>
            <p className="text-sm font-medium">Checks Passing</p>
            <p className="text-xs text-[#6b6b6b] mt-1">Compliance checklist</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Compliance Checklist</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-[#f0f0f0]">
          {checks.map(({ label, pass }) => (
            <div key={label} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {pass ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                )}
                <span className="text-sm">{label}</span>
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
