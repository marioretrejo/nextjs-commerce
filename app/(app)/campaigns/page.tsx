"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Phone, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "completed";

interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  total_contacts: number;
  completed_contacts: number;
  converted_contacts: number;
  start_at: string | null;
  agent?: { name: string; voice_engine: string } | null;
}

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  active: "Active",
  paused: "Stopped",
  completed: "Completed",
};

const STATUS_STYLE: Record<CampaignStatus, string> = {
  draft: "border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs font-normal",
  scheduled: "border-blue-200 text-blue-700 bg-blue-50 text-xs font-normal",
  active: "border-green-200 text-green-700 bg-green-50 text-xs font-normal",
  paused: "border-amber-200 text-amber-700 bg-amber-50 text-xs font-normal",
  completed: "border-[#e0e0e0] text-[#0a0a0a] bg-[#f5f5f5] text-xs font-normal",
};

type TabId = "all" | "active" | "paused" | "draft" | "completed";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("all");

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) =>
        r.ok ? (r.json() as Promise<Campaign[]>) : Promise.reject(),
      )
      .then((data) => setCampaigns(data))
      .catch(() => toast.error("Failed to load campaigns"))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(
    () => ({
      all: campaigns.length,
      active: campaigns.filter((c) => c.status === "active").length,
      paused: campaigns.filter((c) => c.status === "paused").length,
      draft: campaigns.filter((c) => c.status === "draft").length,
      completed: campaigns.filter((c) => c.status === "completed").length,
    }),
    [campaigns],
  );

  const filtered = useMemo(() => {
    let list = campaigns;
    if (activeTab !== "all") list = list.filter((c) => c.status === activeTab);
    if (search.trim())
      list = list.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()),
      );
    return list;
  }, [campaigns, activeTab, search]);

  const totalContacts = campaigns.reduce((s, c) => s + c.total_contacts, 0);
  const totalInteractions = campaigns.reduce(
    (s, c) => s + c.completed_contacts,
    0,
  );
  const totalConverted = campaigns.reduce(
    (s, c) => s + c.converted_contacts,
    0,
  );
  const connectRate =
    totalContacts > 0
      ? ((totalInteractions / totalContacts) * 100).toFixed(2)
      : "0.00";
  const successRate =
    totalContacts > 0
      ? ((totalConverted / totalContacts) * 100).toFixed(2)
      : "0.00";

  const TABS: { id: TabId; label: string }[] = [
    { id: "all", label: `All (${counts.all})` },
    { id: "active", label: `Active (${counts.active})` },
    { id: "paused", label: `Stopped (${counts.paused})` },
    { id: "completed", label: `Completed (${counts.completed})` },
    { id: "draft", label: `Draft (${counts.draft})` },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">
          Campaigns
        </h1>
        <Link href="/campaigns/new">
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            New
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[#e0e0e0] mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.id
                ? "border-[#0a0a0a] text-[#0a0a0a]"
                : "border-transparent text-[#6b6b6b] hover:text-[#0a0a0a]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b6b6b]" />
        <Input
          placeholder="Search Campaigns"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* Table */}
      <div className="border border-[#e0e0e0] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e0e0e0] bg-white">
              <th className="px-4 py-3 text-left text-xs font-normal text-[#6b6b6b] w-16">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#0a0a0a]">
                Campaign name
              </th>
              <th className="px-4 py-3 text-right text-xs text-[#0a0a0a]">
                <div className="font-semibold">
                  {totalContacts.toLocaleString()}
                </div>
                <div className="font-normal text-[#6b6b6b]">Total Contacts</div>
              </th>
              <th className="px-4 py-3 text-right text-xs text-[#0a0a0a]">
                <div className="font-semibold">
                  {totalInteractions.toLocaleString()}
                </div>
                <div className="font-normal text-[#6b6b6b]">
                  Total Interactions
                </div>
              </th>
              <th className="px-4 py-3 text-right text-xs text-[#0a0a0a]">
                <div className="font-semibold">{connectRate}%</div>
                <div className="font-normal text-[#6b6b6b]">Connect Rate</div>
              </th>
              <th className="px-4 py-3 text-right text-xs text-[#0a0a0a]">
                <div className="font-semibold">{successRate}%</div>
                <div className="font-normal text-[#6b6b6b]">Success Rate</div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-normal text-[#6b6b6b]">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-[#e0e0e0]">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <div className="h-3.5 bg-[#f5f5f5] rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-14 text-center text-[#6b6b6b] text-sm"
                >
                  {search
                    ? `No campaigns match "${search}"`
                    : "No campaigns yet"}
                </td>
              </tr>
            ) : (
              filtered.map((campaign) => {
                const cr =
                  campaign.total_contacts > 0
                    ? (
                        (campaign.completed_contacts /
                          campaign.total_contacts) *
                        100
                      ).toFixed(2)
                    : "0.00";
                const sr =
                  campaign.total_contacts > 0
                    ? (
                        (campaign.converted_contacts /
                          campaign.total_contacts) *
                        100
                      ).toFixed(2)
                    : "0.00";

                return (
                  <tr
                    key={campaign.id}
                    className="border-b border-[#e0e0e0] hover:bg-[#fafafa] transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 text-[#6b6b6b]">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <Phone className="w-3.5 h-3.5" />
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="font-medium text-[#0a0a0a] hover:underline"
                      >
                        {campaign.name}
                      </Link>
                      {campaign.agent && (
                        <p className="text-xs text-[#6b6b6b] mt-0.5">
                          {campaign.agent.name}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right text-[#0a0a0a]">
                      {campaign.total_contacts.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right text-[#0a0a0a]">
                      {campaign.completed_contacts.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span
                        className={
                          cr !== "0.00"
                            ? "text-blue-600 font-medium"
                            : "text-[#6b6b6b]"
                        }
                      >
                        {cr}%{" "}
                        <span className="text-[#6b6b6b] font-normal">
                          ({campaign.completed_contacts})
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span
                        className={
                          sr !== "0.00"
                            ? "text-blue-600 font-medium"
                            : "text-[#6b6b6b]"
                        }
                      >
                        {sr}%{" "}
                        <span className="text-[#6b6b6b] font-normal">
                          ({campaign.converted_contacts})
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge className={STATUS_STYLE[campaign.status]}>
                        {STATUS_LABEL[campaign.status]}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
