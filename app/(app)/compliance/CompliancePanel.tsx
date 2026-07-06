"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PhoneOff, Clock, Lock, FileText, ShieldCheck } from "lucide-react";
import { QARulesManager } from "./QARulesManager";
import { useCompliance } from "./_components/useCompliance";
import { PanelDncTab } from "./_panel/PanelDncTab";
import { PanelHoursTab } from "./_panel/PanelHoursTab";
import { PanelPrivacyTab } from "./_panel/PanelPrivacyTab";
import { PanelReportTab } from "./_panel/PanelReportTab";

export function CompliancePanel() {
  const c = useCompliance();

  if (c.loading) {
    return <div className="h-64 bg-[#f5f5f5] rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[#111]">Compliance Rules</h3>
          <p className="text-xs text-[#6b6b6b] mt-0.5">
            DNC lists, calling hours, data policies, and QA scoring rules
          </p>
        </div>
        <Badge
          className={
            c.score >= 80
              ? "bg-green-600 text-white"
              : c.score >= 50
                ? "bg-yellow-500 text-white"
                : "bg-red-600 text-white"
          }
        >
          Score {c.score}%
        </Badge>
      </div>

      <Tabs defaultValue="dnc">
        <TabsList className="h-9">
          <TabsTrigger value="dnc" className="text-xs gap-1.5">
            <PhoneOff className="h-3.5 w-3.5" />
            DNC List
          </TabsTrigger>
          <TabsTrigger value="hours" className="text-xs gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Calling Hours
          </TabsTrigger>
          <TabsTrigger value="privacy" className="text-xs gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Data &amp; Privacy
          </TabsTrigger>
          <TabsTrigger value="report" className="text-xs gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Report
          </TabsTrigger>
          <TabsTrigger value="qa-rules" className="text-xs gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            QA Rules
          </TabsTrigger>
        </TabsList>

        <PanelDncTab c={c} />
        <PanelHoursTab c={c} />
        <PanelPrivacyTab c={c} />
        <PanelReportTab c={c} />

        {/* QA Rules */}
        <TabsContent value="qa-rules" className="pt-4">
          <QARulesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
