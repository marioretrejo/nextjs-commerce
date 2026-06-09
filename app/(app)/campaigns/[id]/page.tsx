"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Download,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  PhoneCall,
  X,
} from "lucide-react";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  status: string;
  agent_id: string | null;
  total_contacts: number;
  completed_contacts: number;
  converted_contacts: number;
  max_concurrency: number;
  max_retries: number;
  start_at: string | null;
  workspace_id: string;
  agent?: { name: string } | null;
}

interface Contact {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  status: string;
  attempts: number;
  last_called_at: string | null;
  call_id: string | null;
  variables: Record<string, unknown> | null;
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_META: Record<
  string,
  { label: string; color: string; bar: string }
> = {
  converted: {
    label: "Interested",
    color: "bg-emerald-50 text-emerald-700",
    bar: "bg-emerald-500",
  },
  rejected: {
    label: "Not Interested",
    color: "bg-amber-50 text-amber-700",
    bar: "bg-amber-400",
  },
  no_answer: {
    label: "No Answer",
    color: "bg-yellow-50 text-yellow-700",
    bar: "bg-yellow-400",
  },
  voicemail: {
    label: "Voicemail",
    color: "bg-slate-100 text-slate-600",
    bar: "bg-slate-400",
  },
  invalid: {
    label: "Wrong Number",
    color: "bg-pink-50 text-pink-700",
    bar: "bg-pink-400",
  },
  max_attempts: {
    label: "Max Attempts",
    color: "bg-red-50 text-red-700",
    bar: "bg-red-500",
  },
  calling: {
    label: "In Progress",
    color: "bg-blue-50 text-blue-700",
    bar: "bg-blue-500",
  },
  pending: {
    label: "Pending Retry",
    color: "bg-[#f5f5f5] text-[#6b6b6b]",
    bar: "bg-[#d0d0d0]",
  },
};

const BAR_ORDER = [
  "converted",
  "rejected",
  "no_answer",
  "voicemail",
  "invalid",
  "max_attempts",
  "calling",
  "pending",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function exportToCsv(contacts: Contact[], campaignName: string) {
  if (!contacts.length) {
    toast.error("No contacts to export");
    return;
  }
  const varKeys = Array.from(
    new Set(
      contacts.flatMap((c) => (c.variables ? Object.keys(c.variables) : [])),
    ),
  );
  const headers = [
    "Name",
    "Phone",
    "Email",
    "Status",
    "Attempts",
    "Last Called",
    ...varKeys,
  ];
  const rows = contacts.map((c) => [
    c.name ?? "",
    c.phone,
    c.email ?? "",
    STATUS_META[c.status]?.label ?? c.status,
    c.attempts,
    c.last_called_at ? new Date(c.last_called_at).toLocaleString() : "",
    ...varKeys.map((k) => String(c.variables?.[k] ?? "")),
  ]);
  const csv = [headers, ...rows]
    .map((row) =>
      row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${campaignName}-contacts.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Test Call Modal ────────────────────────────────────────────────────────────

function TestCallModal({
  agentId,
  variableKeys,
  onClose,
}: {
  agentId: string;
  variableKeys: string[];
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [varVals, setVarVals] = useState<Record<string, string>>({});
  const [calling, setCalling] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);

  function setVar(key: string, val: string) {
    setVarVals((prev) => ({ ...prev, [key]: val }));
  }

  async function start() {
    if (!phone.match(/^\+[1-9]\d{6,14}$/)) {
      toast.error("Phone must be E.164 format (+1234567890)");
      return;
    }
    setCalling(true);
    try {
      const variables: Record<string, string> = {};
      if (name) variables["contact_name"] = name;
      variableKeys.forEach((k) => {
        if (varVals[k]) variables[k] = varVals[k];
      });

      const res = await fetch("/api/calls/dial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, to: phone, variables }),
      });
      const d = (await res.json()) as {
        call_id?: string;
        room_name?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(d.error ?? "Failed to initiate test call");
      } else {
        setCallId(d.call_id ?? d.room_name ?? null);
        toast.success(`Test call initiated → ${phone}`);
      }
    } catch {
      toast.error("Network error — could not start call");
    }
    setCalling(false);
  }

  const canStart = phone.trim().length > 0 && !calling;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#e0e0e0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#f5f5f5] flex items-center justify-center">
              <PhoneCall className="w-5 h-5 text-[#0a0a0a]" />
            </div>
            <p className="font-semibold text-[#0a0a0a] text-sm">
              {callId ? "Call in progress" : "Initiate a new test"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#6b6b6b] hover:text-[#0a0a0a] rounded p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {callId ? (
          /* ── Active call state ── */
          <div className="px-5 py-8 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
              <PhoneCall className="w-7 h-7 text-emerald-600 animate-pulse" />
            </div>
            <p className="text-sm font-medium text-[#0a0a0a]">
              Calling {phone}…
            </p>
            <p className="text-xs text-[#6b6b6b] font-mono">{callId}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 text-xs"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        ) : (
          /* ── Form ── */
          <div className="px-5 py-4 space-y-3">
            {/* Name */}
            <div className="space-y-1">
              <Label className="text-xs text-[#6b6b6b]">Name</Label>
              <Input
                placeholder="Contact name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 text-sm rounded-xl border-[#e0e0e0] bg-[#f9f9f9]"
              />
            </div>

            {/* Phone (required) */}
            <div className="space-y-1">
              <Label className="text-xs text-[#6b6b6b]">
                International Phone Number{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="+1 809 905 2406"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 text-sm rounded-xl border-[#e0e0e0] bg-[#f9f9f9]"
              />
            </div>

            {/* Dynamic variable fields from campaign contacts */}
            {variableKeys.map((key) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs text-[#6b6b6b] capitalize">
                  {key.replace(/_/g, " ")}
                </Label>
                <Input
                  placeholder={key}
                  value={varVals[key] ?? ""}
                  onChange={(e) => setVar(key, e.target.value)}
                  className="h-10 text-sm rounded-xl border-[#e0e0e0] bg-[#f9f9f9]"
                />
              </div>
            ))}

            <div className="pt-2">
              <Button
                className="w-full h-11 rounded-xl text-sm font-medium"
                onClick={start}
                disabled={!canStart}
              >
                {calling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Calling…
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Contact Modal ──────────────────────────────────────────────────────────

function AddContactModal({
  campaignId,
  variableKeys,
  onClose,
  onAdded,
}: {
  campaignId: string;
  variableKeys: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [varVals, setVarVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function setVar(key: string, val: string) {
    setVarVals((prev) => ({ ...prev, [key]: val }));
  }

  async function save() {
    if (!phone.trim()) {
      toast.error("Phone is required");
      return;
    }
    setSaving(true);
    const variables: Record<string, string> = {};
    variableKeys.forEach((k) => {
      if (varVals[k]) variables[k] = varVals[k];
    });

    const res = await fetch(`/api/campaigns/${campaignId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contacts: [
          {
            name: name || null,
            phone: phone.trim(),
            email: email || null,
            status: "pending",
            attempts: 0,
            variables: Object.keys(variables).length > 0 ? variables : null,
          },
        ],
      }),
    });
    if (!res.ok) {
      toast.error("Failed to add contact");
    } else {
      toast.success("Contact added");
      onAdded();
      onClose();
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-2xl mx-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#e0e0e0]">
          <p className="font-semibold text-[#0a0a0a] text-sm">Add Contact</p>
          <button
            onClick={onClose}
            className="text-[#6b6b6b] hover:text-[#0a0a0a] rounded p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#6b6b6b]">Name</Label>
            <Input
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 text-sm rounded-xl border-[#e0e0e0] bg-[#f9f9f9]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[#6b6b6b]">
              Phone <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="+1 809 905 2406"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-10 text-sm rounded-xl border-[#e0e0e0] bg-[#f9f9f9]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[#6b6b6b]">Email</Label>
            <Input
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 text-sm rounded-xl border-[#e0e0e0] bg-[#f9f9f9]"
            />
          </div>
          {variableKeys.map((key) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-[#6b6b6b] capitalize">
                {key.replace(/_/g, " ")}
              </Label>
              <Input
                placeholder={key}
                value={varVals[key] ?? ""}
                onChange={(e) => setVar(key, e.target.value)}
                className="h-10 text-sm rounded-xl border-[#e0e0e0] bg-[#f9f9f9]"
              />
            </div>
          ))}
          <div className="pt-2">
            <Button
              className="w-full h-11 rounded-xl text-sm"
              onClick={save}
              disabled={saving || !phone.trim()}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Add Contact
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [search, setSearch] = useState("");
  const [testOpen, setTestOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  async function refetchCampaign() {
    try {
      const r = await fetch(`/api/campaigns/${id}`);
      if (r.ok) setCampaign((await r.json()) as Campaign);
    } catch {
      /* non-fatal background refetch */
    }
  }

  async function refetchContacts() {
    const r = await fetch(`/api/campaigns/${id}/contacts`);
    if (r.ok) setContacts((await r.json()) as Contact[]);
  }

  useEffect(() => {
    async function load() {
      try {
        const [campRes, coRes] = await Promise.all([
          fetch(`/api/campaigns/${id}`),
          fetch(`/api/campaigns/${id}/contacts`),
        ]);
        if (campRes.ok) setCampaign((await campRes.json()) as Campaign);
        if (coRes.ok) setContacts((await coRes.json()) as Contact[]);
      } catch {
        /* ignore */
      }
      setLoading(false);
    }
    load();

    const supabase = createClient();
    const contactsChannel = supabase
      .channel(`campaign-contacts-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_contacts",
          filter: `campaign_id=eq.${id}`,
        },
        () => {
          void Promise.allSettled([refetchContacts(), refetchCampaign()]);
        },
      )
      .subscribe();
    const campaignChannel = supabase
      .channel(`campaign-row-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "campaigns",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setCampaign((c) =>
            c ? { ...c, ...(payload.new as Partial<Campaign>) } : c,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(contactsChannel);
      supabase.removeChannel(campaignChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function launch() {
    setActing(true);
    const res = await fetch(`/api/campaigns/${id}/launch`, { method: "POST" });
    if (res.ok) {
      toast.success("Campaign launched!");
      setCampaign((c) => (c ? { ...c, status: "active" } : c));
    } else toast.error(((await res.json()) as { error: string }).error);
    setActing(false);
  }

  async function pause() {
    setActing(true);
    const res = await fetch(`/api/campaigns/${id}/pause`, { method: "POST" });
    if (res.ok) {
      toast.success("Campaign paused");
      setCampaign((c) => (c ? { ...c, status: "paused" } : c));
    }
    setActing(false);
  }

  // ── Computed stats ─────────────────────────────────────────────────────────

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    BAR_ORDER.forEach((s) => {
      counts[s] = 0;
    });
    contacts.forEach((c) => {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    });
    return counts;
  }, [contacts]);

  const totalInteractions = useMemo(
    () => contacts.reduce((s, c) => s + c.attempts, 0),
    [contacts],
  );

  const connectRate = useMemo(() => {
    const withAttempts = contacts.filter((c) => c.attempts > 0).length;
    const connected = contacts.filter((c) =>
      ["converted", "rejected"].includes(c.status),
    ).length;
    return withAttempts > 0
      ? ((connected / withAttempts) * 100).toFixed(1)
      : "0.0";
  }, [contacts]);

  const successRate = useMemo(() => {
    const withAttempts = contacts.filter((c) => c.attempts > 0).length;
    const converted = contacts.filter((c) => c.status === "converted").length;
    return withAttempts > 0
      ? ((converted / withAttempts) * 100).toFixed(1)
      : "0.0";
  }, [contacts]);

  // Extract variable keys from contacts for the test/add modals
  const variableKeys = useMemo(() => {
    const keys = new Set<string>();
    contacts.forEach((c) => {
      if (c.variables && typeof c.variables === "object") {
        Object.keys(c.variables).forEach((k) => keys.add(k));
      }
    });
    // Remove keys that are already standard fields
    ["contact_name", "name", "phone", "email"].forEach((k) => keys.delete(k));
    return Array.from(keys);
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        (c.name ?? "").toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email ?? "").toLowerCase().includes(q),
    );
  }, [contacts, search]);

  if (loading)
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-[#f5f5f5] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  if (!campaign)
    return <div className="p-6 text-[#6b6b6b]">Campaign not found.</div>;

  const total = campaign.total_contacts || 1;

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/campaigns">
              <Button variant="ghost" size="icon" className="w-8 h-8">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#0a0a0a]">
                {campaign.name}
              </h1>
              <Badge
                className={
                  campaign.status === "active"
                    ? "bg-green-50 border-green-200 text-green-700 text-xs"
                    : campaign.status === "paused"
                      ? "bg-amber-50 border-amber-200 text-amber-700 text-xs"
                      : campaign.status === "draft"
                        ? "border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs"
                        : campaign.status === "completed"
                          ? "bg-[#f5f5f5] text-[#0a0a0a] border-[#e0e0e0] text-xs"
                          : "border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs"
                }
              >
                {campaign.status === "paused"
                  ? "Stopped"
                  : campaign.status.charAt(0).toUpperCase() +
                    campaign.status.slice(1)}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {campaign.status === "draft" || campaign.status === "paused" ? (
              <Button
                size="sm"
                onClick={launch}
                disabled={acting}
                className="text-xs"
              >
                {acting ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                )}
                Launch
              </Button>
            ) : campaign.status === "active" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={pause}
                disabled={acting}
                className="text-xs"
              >
                <Pause className="w-3.5 h-3.5 mr-1.5" /> Pause
              </Button>
            ) : null}
            {campaign.agent_id && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => setTestOpen(true)}
              >
                <PhoneCall className="w-3.5 h-3.5 mr-1.5" /> Test
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Contact
            </Button>
          </div>
        </div>

        {/* ── Stats + Progress area ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: contacts bar + breakdown */}
          <div className="lg:col-span-2 border border-[#e0e0e0] rounded-xl p-5">
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-sm font-medium text-[#0a0a0a]">
                Total contacts:
              </p>
              <span className="text-2xl font-bold text-[#0a0a0a]">
                {campaign.total_contacts.toLocaleString()}
              </span>
            </div>

            {/* Multicolor segmented bar */}
            <div className="flex h-2.5 rounded-full overflow-hidden gap-px mb-4">
              {BAR_ORDER.map((status) => {
                const pct = ((statusCounts[status] ?? 0) / total) * 100;
                if (pct === 0) return null;
                return (
                  <div
                    key={status}
                    className={`${STATUS_META[status]?.bar ?? "bg-[#d0d0d0]"} transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${STATUS_META[status]?.label ?? status}: ${statusCounts[status]}`}
                  />
                );
              })}
              {campaign.total_contacts === 0 && (
                <div className="flex-1 bg-[#e0e0e0] rounded-full" />
              )}
            </div>

            {/* Status breakdown labels */}
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {BAR_ORDER.filter((s) => (statusCounts[s] ?? 0) > 0).map(
                (status) => (
                  <div
                    key={status}
                    className="flex items-center gap-1.5 text-xs text-[#0a0a0a]"
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${STATUS_META[status]?.bar ?? "bg-[#d0d0d0]"}`}
                    />
                    <span className="text-[#6b6b6b]">
                      {STATUS_META[status]?.label ?? status}:
                    </span>
                    <span className="font-medium">{statusCounts[status]}</span>
                  </div>
                ),
              )}
              {contacts.length === 0 && (
                <p className="text-xs text-[#6b6b6b]">No contacts yet</p>
              )}
            </div>
          </div>

          {/* Right: key metrics */}
          <div className="border border-[#e0e0e0] rounded-xl p-5 space-y-4">
            <div>
              <p className="text-xs text-[#6b6b6b]">Total Interactions</p>
              <p className="text-2xl font-bold text-[#0a0a0a]">
                {totalInteractions.toLocaleString()}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#e0e0e0]">
              <div>
                <p className="text-xs text-[#6b6b6b]">Connect Rate</p>
                <p className="text-xl font-bold text-[#0a0a0a]">
                  {connectRate}%
                </p>
                <p className="text-xs text-[#6b6b6b]">
                  {
                    contacts.filter((c) =>
                      ["converted", "rejected"].includes(c.status),
                    ).length
                  }{" "}
                  contacts
                </p>
              </div>
              <div>
                <p className="text-xs text-[#6b6b6b]">Success Rate</p>
                <p className="text-xl font-bold text-[#0a0a0a]">
                  {successRate}%
                </p>
                <p className="text-xs text-[#6b6b6b]">
                  {statusCounts["converted"] ?? 0} contacts
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Contacts table ── */}
        <div className="border border-[#e0e0e0] rounded-xl overflow-hidden">
          {/* Table header with search + export */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e0e0e0] bg-white">
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b6b6b]" />
              <input
                placeholder="Search Contacts"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 h-8 text-xs border border-[#e0e0e0] rounded-lg bg-[#fafafa] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs shrink-0"
              onClick={() => exportToCsv(contacts, campaign.name)}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export contacts
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e0e0e0] bg-[#fafafa]">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6b6b6b]">
                    Name and Phone Number
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6b6b6b]">
                    Attempts
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6b6b6b]">
                    Last Attempt
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6b6b6b]">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6b6b6b]">
                    Variables
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.slice(0, 200).map((c) => {
                  const meta = STATUS_META[c.status];
                  const varEntries = c.variables
                    ? Object.entries(c.variables).slice(0, 3)
                    : [];
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-[#e0e0e0] hover:bg-[#fafafa]"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#0a0a0a] text-xs">
                          {c.name ?? "—"}
                        </p>
                        <p className="text-xs text-[#6b6b6b] font-mono">
                          {c.phone}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#0a0a0a]">
                        {c.attempts}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6b6b6b]">
                        {c.last_called_at
                          ? new Date(c.last_called_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${meta?.color ?? "bg-[#f5f5f5] text-[#6b6b6b]"}`}
                        >
                          {meta?.label ?? c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6b6b6b] max-w-xs">
                        {varEntries.length > 0
                          ? varEntries.map(([k, v]) => (
                              <span key={k} className="mr-2">
                                <span className="text-[#0a0a0a] font-medium">
                                  {k}:
                                </span>{" "}
                                {String(v)}
                              </span>
                            ))
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
                {filteredContacts.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-xs text-[#6b6b6b]"
                    >
                      {search
                        ? `No contacts match "${search}"`
                        : "No contacts yet"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredContacts.length > 200 && (
            <div className="px-4 py-2.5 border-t border-[#e0e0e0] bg-[#fafafa] text-xs text-[#6b6b6b]">
              Showing 200 of {filteredContacts.length} contacts
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {testOpen && campaign.agent_id && (
        <TestCallModal
          agentId={campaign.agent_id}
          variableKeys={variableKeys}
          onClose={() => setTestOpen(false)}
        />
      )}
      {addOpen && (
        <AddContactModal
          campaignId={id}
          variableKeys={variableKeys}
          onClose={() => setAddOpen(false)}
          onAdded={refetchContacts}
        />
      )}
    </>
  );
}
