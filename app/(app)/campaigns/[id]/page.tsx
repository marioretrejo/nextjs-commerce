"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Loader2, Pause, Play, Plus, PhoneCall } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

import type { Campaign, Contact } from "./_components/types";
import { STATUS_META, BAR_ORDER } from "./_components/types";
import { exportToCsv } from "./_components/export-csv";
import { TestCallModal } from "./_components/TestCallModal";
import { AddContactModal } from "./_components/AddContactModal";
import { ContactsTable } from "./_components/ContactsTable";

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

        <ContactsTable
          contacts={contacts}
          filteredContacts={filteredContacts}
          search={search}
          setSearch={setSearch}
          campaign={campaign}
        />
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
