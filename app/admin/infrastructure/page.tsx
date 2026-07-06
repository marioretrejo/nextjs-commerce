"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, Lock } from "lucide-react";
import Link from "next/link";
import type { Tab } from "./_components/types";
import {
  TABS,
  VOICE_ENGINES,
  TELEPHONY_PROVIDERS,
  MOCK_WORKSPACE_COSTS,
} from "./_components/config";
import { ProviderHealthTab } from "./_components/ProviderHealthTab";

export default function InfrastructurePage() {
  const [tab, setTab] = useState<Tab>("health");

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="bg-white border-b border-[#e0e0e0] px-6 py-4 flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-[#0a0a0a]">Infrastructure</h1>
          <p className="text-xs text-[#6b6b6b]">
            Superadmin only — provider configuration, cost visibility, and
            real-time health
          </p>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg border border-[#e0e0e0] p-1 w-fit">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === id
                  ? "bg-[#0a0a0a] text-white"
                  : "text-[#6b6b6b] hover:text-[#0a0a0a]"
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* TAB 1 — Voice Engines */}
        {tab === "voice" && (
          <div className="space-y-4">
            <p className="text-sm text-[#6b6b6b]">
              Configure which voice engine powers each client-facing tier.
              Internal reference only — clients see tier names, never provider
              names.
            </p>
            {VOICE_ENGINES.map((engine) => (
              <Card key={engine.tier}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-semibold text-[#0a0a0a]">
                          {engine.tier}
                        </p>
                        <Badge className="text-xs bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]">
                          {engine.internal}
                        </Badge>
                        {engine.status === "locked" && (
                          <Badge className="text-xs bg-[#0a0a0a] text-white border-transparent flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Locked
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-6 mt-3 text-sm">
                        <div>
                          <p className="text-xs text-[#6b6b6b] mb-0.5">
                            Internal engine
                          </p>
                          <p className="font-mono text-xs text-[#0a0a0a]">
                            {engine.defaultEngine}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6b6b6b] mb-0.5">
                            Cost / minute
                          </p>
                          <p className="font-medium">
                            ${engine.costPerMin.toFixed(3)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6b6b6b] mb-0.5">
                            Minutes this month
                          </p>
                          <p className="font-medium">
                            {engine.monthlyMinutes.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-xs text-[#6b6b6b] mb-1">
                          API Key ({engine.envKey})
                        </p>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-xs font-mono text-[#6b6b6b]">
                            ••••••••••••••••••••••••••••••••
                          </span>
                        </div>
                      </div>
                    </div>
                    {engine.altInternal && (
                      <div className="text-right">
                        <p className="text-xs text-[#6b6b6b] mb-2">
                          Failover to
                        </p>
                        <Badge className="text-xs border-[#e0e0e0] text-[#6b6b6b] bg-white">
                          {engine.altInternal}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* TAB 2 — Telephony */}
        {tab === "telephony" && (
          <div className="space-y-4">
            <p className="text-sm text-[#6b6b6b]">
              BYOT (Bring Your Own Telephony) configuration. All provider
              details are superadmin-only and never visible to clients.
            </p>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Telephony Providers</CardTitle>
                <CardDescription>
                  Manage provider credentials, configure defaults, and
                  per-workspace overrides.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-5 gap-3 px-5 py-3 border-b border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
                  <span>Provider</span>
                  <span>Type</span>
                  <span>Status</span>
                  <span>Cost/min</span>
                  <span />
                </div>
                <div className="divide-y divide-[#e0e0e0]">
                  {TELEPHONY_PROVIDERS.map((p) => (
                    <div
                      key={p.type}
                      className="grid grid-cols-5 gap-3 px-5 py-4 text-sm items-center"
                    >
                      <span className="font-medium text-[#0a0a0a]">
                        {p.name}
                      </span>
                      <span className="text-[#6b6b6b] font-mono text-xs">
                        {p.type}
                      </span>
                      <span>
                        {p.status === "active" ? (
                          <Badge className="bg-[#0a0a0a] text-white border-transparent text-xs">
                            Active
                          </Badge>
                        ) : (
                          <Badge className="border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs">
                            Disconnected
                          </Badge>
                        )}
                      </span>
                      <span className="text-[#6b6b6b] font-mono text-xs">
                        {p.cost}
                      </span>
                      <span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                        >
                          Configure
                        </Button>
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">BYOT Call Flow</CardTitle>
                <CardDescription>
                  Session anonymization is always ON. Voice AI never receives
                  real phone numbers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm text-[#6b6b6b]">
                  {[
                    "Generate anonymized session_id = uuid()",
                    "Store mapping server-side: session_id → { contact_id, phone, campaign_id }",
                    "Initiate call via telephony provider (Twilio/Telnyx) using real phone number",
                    "Bridge audio stream to Voice AI using only session_id",
                    "Voice AI receives: audio + agent config only — no phone number, no contact surname",
                    'Dynamic variables use generic labels: contact_ref="C-4872", greeting_name="Juan"',
                    "On call end: webhook → map session_id → store results in Supabase",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] text-white text-xs font-bold">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 3 — Cost Dashboard */}
        {tab === "costs" && (
          <div className="space-y-4">
            <p className="text-sm text-[#6b6b6b]">
              Internal cost visibility — never shown to clients. Shows margin
              per workspace and infrastructure spend.
            </p>
            <div className="grid grid-cols-4 gap-4">
              {[
                {
                  label: "Total Infrastructure Cost",
                  value: `$${MOCK_WORKSPACE_COSTS.reduce((s, w) => s + w.providerCost, 0).toFixed(2)}`,
                  sub: "This month",
                },
                {
                  label: "Total Revenue",
                  value: `$${MOCK_WORKSPACE_COSTS.reduce((s, w) => s + w.planRevenue, 0).toFixed(2)}`,
                  sub: "Subscription + overage",
                },
                {
                  label: "Gross Margin",
                  value: (() => {
                    const rev = MOCK_WORKSPACE_COSTS.reduce(
                      (s, w) => s + w.planRevenue,
                      0,
                    );
                    const cost = MOCK_WORKSPACE_COSTS.reduce(
                      (s, w) => s + w.providerCost,
                      0,
                    );
                    return `${(((rev - cost) / rev) * 100).toFixed(1)}%`;
                  })(),
                  sub: "Revenue minus provider cost",
                },
                {
                  label: "Active Workspaces",
                  value: String(
                    MOCK_WORKSPACE_COSTS.filter((w) => w.minutesUsed > 0)
                      .length,
                  ),
                  sub: "With usage this month",
                },
              ].map((m) => (
                <Card key={m.label}>
                  <CardContent className="p-5">
                    <p className="text-sm text-[#6b6b6b] mb-2">{m.label}</p>
                    <p className="text-2xl font-bold text-[#0a0a0a]">
                      {m.value}
                    </p>
                    <p className="text-xs text-[#6b6b6b] mt-1">{m.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Per-Workspace Margin
                </CardTitle>
                <CardDescription>
                  Cost, revenue, and margin by workspace. Internal only.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-6 gap-3 px-5 py-3 border-b border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
                  <span className="col-span-2">Workspace</span>
                  <span>Plan</span>
                  <span className="text-right">Revenue</span>
                  <span className="text-right">Provider Cost</span>
                  <span className="text-right">Margin</span>
                </div>
                <div className="divide-y divide-[#e0e0e0]">
                  {MOCK_WORKSPACE_COSTS.map((w) => {
                    const margin = w.planRevenue - w.providerCost;
                    return (
                      <div
                        key={w.name}
                        className="grid grid-cols-6 gap-3 px-5 py-3 text-sm items-center hover:bg-[#f5f5f5]"
                      >
                        <span className="col-span-2 font-medium text-[#0a0a0a]">
                          {w.name}
                        </span>
                        <span className="capitalize text-[#6b6b6b]">
                          {w.plan}
                        </span>
                        <span className="text-right">${w.planRevenue}</span>
                        <span className="text-right text-[#6b6b6b]">
                          ${w.providerCost.toFixed(2)}
                        </span>
                        <span
                          className={`text-right font-medium ${margin < 0 ? "text-red-600" : "text-[#0a0a0a]"}`}
                        >
                          {margin < 0 ? "-" : "+"}${Math.abs(margin).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 4 — Provider Health (Real data) */}
        {tab === "health" && <ProviderHealthTab />}
      </div>
    </div>
  );
}
