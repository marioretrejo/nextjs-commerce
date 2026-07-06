// Compliance content has been merged into QA Center → /qa-center (Compliance Rules tab).
// This page is kept for backwards-compatibility with direct links.
"use client";

import { useState, useEffect, useCallback } from "react";
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
import type { DncEntry, ComplianceSettings } from "@/lib/supabase/types";
import { toast } from "sonner";
import { QARulesManager } from "./QARulesManager";
import {
  DEFAULT_SETTINGS,
  type ComplianceCheck,
} from "./_components/constants";
import { DncTab } from "./_components/DncTab";
import { CallingHoursTab } from "./_components/CallingHoursTab";
import { PrivacyTab } from "./_components/PrivacyTab";
import { ReportTab } from "./_components/ReportTab";

export default function CompliancePage() {
  const [dncEntries, setDncEntries] = useState<DncEntry[]>([]);
  const [settings, setSettings] =
    useState<Partial<ComplianceSettings>>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const [newPhone, setNewPhone] = useState("");
  const [newReason, setNewReason] = useState("");
  const [addingPhone, setAddingPhone] = useState(false);
  const [dncSearch, setDncSearch] = useState("");

  const [bulkInput, setBulkInput] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [dncRes, settingsRes] = await Promise.all([
      fetch("/api/compliance/dnc"),
      fetch("/api/compliance/settings"),
    ]);
    if (dncRes.ok) setDncEntries((await dncRes.json()) as DncEntry[]);
    if (settingsRes.ok) {
      const s = (await settingsRes.json()) as ComplianceSettings | null;
      if (s) setSettings(s);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function addDncEntry() {
    if (!newPhone.trim()) {
      toast.error("Phone number is required");
      return;
    }
    setAddingPhone(true);
    try {
      const res = await fetch("/api/compliance/dnc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: newPhone.trim(),
          reason: newReason || undefined,
        }),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      const entry = (await res.json()) as DncEntry;
      setDncEntries((e) => [entry, ...e]);
      setNewPhone("");
      setNewReason("");
      toast.success("Number added to DNC list");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setAddingPhone(false);
    }
  }

  async function removeDncEntry(id: string) {
    await fetch(`/api/compliance/dnc?id=${id}`, { method: "DELETE" });
    setDncEntries((e) => e.filter((x) => x.id !== id));
    toast.success("Number removed from DNC list");
  }

  async function bulkImport() {
    const phones = bulkInput
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);
    if (phones.length === 0) {
      toast.error("No valid phone numbers found");
      return;
    }
    setBulkImporting(true);
    try {
      const res = await fetch("/api/compliance/dnc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phones }),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      const { inserted } = (await res.json()) as { inserted: number };
      toast.success(`${inserted} numbers imported`);
      setBulkInput("");
      fetchData();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBulkImporting(false);
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/compliance/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      toast.success("Compliance settings saved");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSavingSettings(false);
    }
  }

  const filteredDnc = dncEntries.filter(
    (e) =>
      dncSearch === "" ||
      e.phone.includes(dncSearch) ||
      (e.reason ?? "").toLowerCase().includes(dncSearch.toLowerCase()),
  );

  // Compliance score
  const checks: ComplianceCheck[] = [
    { label: "DNC list configured", pass: dncEntries.length > 0 },
    {
      label: "Calling hours restricted",
      pass: !!settings.calling_hours_enabled,
    },
    {
      label: "Call recording retention set",
      pass: (settings.call_recording_retention_days ?? 0) > 0,
    },
    { label: "Consent required", pass: !!settings.require_consent },
    {
      label: "TCPA compliance enabled",
      pass: !!settings.tcpa_compliance_enabled,
    },
    {
      label: "GDPR compliance enabled",
      pass: !!settings.gdpr_compliance_enabled,
    },
  ];
  const score = Math.round(
    (checks.filter((c) => c.pass).length / checks.length) * 100,
  );

  if (loading) {
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
              score >= 80
                ? "bg-green-600 text-white"
                : score >= 50
                  ? "bg-yellow-500 text-white"
                  : "bg-red-600 text-white"
            }
          >
            {score}%
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
          dncEntries={dncEntries}
          filteredDnc={filteredDnc}
          newPhone={newPhone}
          setNewPhone={setNewPhone}
          newReason={newReason}
          setNewReason={setNewReason}
          addingPhone={addingPhone}
          onAdd={addDncEntry}
          onRemove={removeDncEntry}
          bulkInput={bulkInput}
          setBulkInput={setBulkInput}
          bulkImporting={bulkImporting}
          onBulkImport={bulkImport}
          dncSearch={dncSearch}
          setDncSearch={setDncSearch}
        />

        <CallingHoursTab
          settings={settings}
          setSettings={setSettings}
          savingSettings={savingSettings}
          onSave={saveSettings}
        />

        <PrivacyTab
          settings={settings}
          setSettings={setSettings}
          savingSettings={savingSettings}
          onSave={saveSettings}
        />

        <ReportTab score={score} dncCount={dncEntries.length} checks={checks} />

        {/* QA Rules Tab */}
        <TabsContent value="qa-rules" className="pt-4">
          <QARulesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
