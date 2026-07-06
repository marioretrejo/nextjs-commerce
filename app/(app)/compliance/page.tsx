// Compliance content has been merged into QA Center → /qa-center (Compliance Rules tab).
// This page is kept for backwards-compatibility with direct links.
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  PhoneOff,
  Clock,
  Lock,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { QARulesManager } from "./QARulesManager";
import { useCompliance } from "./_components/useCompliance";
import { DncTab } from "./_components/DncTab";
import { CallingHoursTab } from "./_components/CallingHoursTab";
import { PrivacyTab } from "./_components/PrivacyTab";
import { ReportTab } from "./_components/ReportTab";

export default function CompliancePage() {
  const c = useCompliance();

  if (c.loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-[#f5f5f5] rounded animate-pulse mb-6" />
        <div className="h-64 bg-[#f5f5f5] rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f5f5]">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Compliance Center
          </h1>
          <p className="text-sm text-[#6b6b6b]">
            Manage DNC lists, calling hours, data policies, and compliance
            status
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-[#6b6b6b]">Compliance Score</span>
          <Badge
            className={
              c.score >= 80
                ? "bg-green-600 text-white"
                : c.score >= 50
                  ? "bg-yellow-500 text-white"
                  : "bg-red-600 text-white"
            }
          >
            {c.score}%
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="dnc">
        <TabsList>
          <TabsTrigger value="dnc">
            <PhoneOff className="h-3.5 w-3.5 mr-1.5" />
            DNC List
          </TabsTrigger>
          <TabsTrigger value="hours">
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            Calling Hours
          </TabsTrigger>
          <TabsTrigger value="privacy">
            <Lock className="h-3.5 w-3.5 mr-1.5" />
            Data & Privacy
          </TabsTrigger>
          <TabsTrigger value="report">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Compliance Report
          </TabsTrigger>
          <TabsTrigger value="qa-rules">
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
            QA Rules
          </TabsTrigger>
        </TabsList>

        <DncTab
          dncEntries={c.dncEntries}
          filteredDnc={c.filteredDnc}
          newPhone={c.newPhone}
          setNewPhone={c.setNewPhone}
          newReason={c.newReason}
          setNewReason={c.setNewReason}
          addingPhone={c.addingPhone}
          onAdd={c.addDncEntry}
          onRemove={c.removeDncEntry}
          bulkInput={c.bulkInput}
          setBulkInput={c.setBulkInput}
          bulkImporting={c.bulkImporting}
          onBulkImport={c.bulkImport}
          dncSearch={c.dncSearch}
          setDncSearch={c.setDncSearch}
        />

        <CallingHoursTab
          settings={c.settings}
          setSettings={c.setSettings}
          savingSettings={c.savingSettings}
          onSave={c.saveSettings}
        />

        <PrivacyTab
          settings={c.settings}
          setSettings={c.setSettings}
          savingSettings={c.savingSettings}
          onSave={c.saveSettings}
        />

        <ReportTab
          score={c.score}
          dncCount={c.dncEntries.length}
          checks={c.checks}
        />

        {/* QA Rules Tab */}
        <TabsContent value="qa-rules" className="pt-4">
          <QARulesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
