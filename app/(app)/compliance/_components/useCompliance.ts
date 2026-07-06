"use client";

import { useState, useEffect, useCallback } from "react";
import type { DncEntry, ComplianceSettings } from "@/lib/supabase/types";
import { toast } from "sonner";
import { DEFAULT_SETTINGS, type ComplianceCheck } from "./constants";

export function useCompliance() {
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

  function toggleDay(day: string) {
    const days = settings.calling_days ?? [];
    setSettings((s) => ({
      ...s,
      calling_days: days.includes(day)
        ? days.filter((d) => d !== day)
        : [...days, day],
    }));
  }

  const filteredDnc = dncEntries.filter(
    (e) =>
      dncSearch === "" ||
      e.phone.includes(dncSearch) ||
      (e.reason ?? "").toLowerCase().includes(dncSearch.toLowerCase()),
  );

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

  return {
    dncEntries,
    settings,
    setSettings,
    loading,
    savingSettings,
    newPhone,
    setNewPhone,
    newReason,
    setNewReason,
    addingPhone,
    dncSearch,
    setDncSearch,
    bulkInput,
    setBulkInput,
    bulkImporting,
    addDncEntry,
    removeDncEntry,
    bulkImport,
    saveSettings,
    toggleDay,
    filteredDnc,
    checks,
    score,
  };
}
