'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Cpu, Phone, DollarSign, Activity, CheckCircle, XCircle, AlertCircle, Lock } from 'lucide-react';
import Link from 'next/link';

type Tab = 'voice' | 'telephony' | 'costs' | 'health';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'voice',     label: 'Voice Engines', icon: <Cpu className="w-4 h-4" /> },
  { id: 'telephony', label: 'Telephony',      icon: <Phone className="w-4 h-4" /> },
  { id: 'costs',     label: 'Cost Dashboard', icon: <DollarSign className="w-4 h-4" /> },
  { id: 'health',    label: 'Provider Health',icon: <Activity className="w-4 h-4" /> },
];

const VOICE_ENGINES = [
  {
    tier: 'Standard Voice',
    internal: 'ElevenLabs v2',
    altInternal: 'Cartesia Sonic-3',
    defaultEngine: 'elevenlabs_v2',
    costPerMin: 0.03,
    monthlyMinutes: 12480,
    envKey: 'ELEVENLABS_API_KEY',
    status: 'active',
  },
  {
    tier: 'Ultra-Fast Voice',
    internal: 'Cartesia Sonic-3',
    altInternal: 'Deepgram',
    defaultEngine: 'cartesia_sonic3',
    costPerMin: 0.025,
    monthlyMinutes: 3120,
    envKey: 'CARTESIA_API_KEY',
    status: 'active',
  },
  {
    tier: 'Premium Voice',
    internal: 'ElevenLabs v3',
    altInternal: null,
    defaultEngine: 'elevenlabs_v3',
    costPerMin: 0.06,
    monthlyMinutes: 780,
    envKey: 'ELEVENLABS_API_KEY',
    status: 'locked',
  },
];

const TELEPHONY_PROVIDERS = [
  { name: 'Twilio',      type: 'twilio',       status: 'active',       cost: '$0.0085/min' },
  { name: 'Telnyx',      type: 'telnyx',       status: 'active',       cost: '$0.0045/min' },
  { name: 'Vonage',      type: 'vonage',       status: 'disconnected', cost: '$0.0090/min' },
  { name: 'VoIP.ms',     type: 'voip_ms',      status: 'disconnected', cost: '$0.0069/min' },
  { name: 'Custom SIP',  type: 'custom_sip',   status: 'disconnected', cost: 'Custom' },
];

const MOCK_WORKSPACE_COSTS = [
  { name: 'Acme Corp',      plan: 'scale', minutesUsed: 4800, planRevenue: 297, providerCost: 144 },
  { name: 'Beta Labs',       plan: 'pro',   minutesUsed: 980,  planRevenue: 97,  providerCost: 29.4 },
  { name: 'Gamma Inc',       plan: 'scale', minutesUsed: 5200, planRevenue: 297, providerCost: 156 },
  { name: 'Delta LLC',       plan: 'free',  minutesUsed: 48,   planRevenue: 0,   providerCost: 1.44 },
  { name: 'Epsilon Co',      plan: 'pro',   minutesUsed: 1100, planRevenue: 97,  providerCost: 33 },
];

const PROVIDER_HEALTH = [
  { name: 'ElevenLabs',  type: 'Voice',     status: 'operational', latency: 210, errorRate: 0.2 },
  { name: 'Cartesia',    type: 'Voice',     status: 'operational', latency: 95,  errorRate: 0.1 },
  { name: 'Deepgram',    type: 'STT',       status: 'degraded',    latency: 380, errorRate: 2.1 },
  { name: 'Twilio',      type: 'Telephony', status: 'operational', latency: 55,  errorRate: 0.3 },
  { name: 'Telnyx',      type: 'Telephony', status: 'operational', latency: 40,  errorRate: 0.1 },
];

function StatusDot({ status }: { status: string }) {
  if (status === 'operational') return <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />;
  if (status === 'degraded')    return <span className="inline-flex h-2 w-2 rounded-full bg-yellow-500" />;
  return <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />;
}

export default function InfrastructurePage() {
  const [tab, setTab] = useState<Tab>('voice');

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="bg-white border-b border-[#e0e0e0] px-6 py-4 flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-[#0a0a0a]">Infrastructure</h1>
          <p className="text-xs text-[#6b6b6b]">Superadmin only — provider configuration and cost visibility</p>
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
                tab === id ? 'bg-[#0a0a0a] text-white' : 'text-[#6b6b6b] hover:text-[#0a0a0a]'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* TAB 1 — Voice Engines */}
        {tab === 'voice' && (
          <div className="space-y-4">
            <p className="text-sm text-[#6b6b6b]">Configure which voice engine powers each client-facing tier. Internal reference only — clients see tier names, never provider names.</p>
            {VOICE_ENGINES.map((engine) => (
              <Card key={engine.tier}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-semibold text-[#0a0a0a]">{engine.tier}</p>
                        <Badge className="text-xs bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]">
                          {engine.internal}
                        </Badge>
                        {engine.status === 'locked' && (
                          <Badge className="text-xs bg-[#0a0a0a] text-white border-transparent flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Locked
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-6 mt-3 text-sm">
                        <div>
                          <p className="text-xs text-[#6b6b6b] mb-0.5">Internal engine</p>
                          <p className="font-mono text-xs text-[#0a0a0a]">{engine.defaultEngine}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6b6b6b] mb-0.5">Cost / minute</p>
                          <p className="font-medium">${engine.costPerMin.toFixed(3)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6b6b6b] mb-0.5">Minutes this month</p>
                          <p className="font-medium">{engine.monthlyMinutes.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-xs text-[#6b6b6b] mb-1">API Key ({engine.envKey})</p>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-xs font-mono text-[#6b6b6b]">••••••••••••••••••••••••••••••••</span>
                        </div>
                      </div>
                    </div>
                    {engine.altInternal && (
                      <div className="text-right">
                        <p className="text-xs text-[#6b6b6b] mb-2">Failover to</p>
                        <Badge className="text-xs border-[#e0e0e0] text-[#6b6b6b] bg-white">{engine.altInternal}</Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* TAB 2 — Telephony */}
        {tab === 'telephony' && (
          <div className="space-y-4">
            <p className="text-sm text-[#6b6b6b]">BYOT (Bring Your Own Telephony) configuration. All provider details are superadmin-only and never visible to clients.</p>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Telephony Providers</CardTitle>
                <CardDescription>Manage provider credentials, configure defaults, and per-workspace overrides.</CardDescription>
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
                    <div key={p.type} className="grid grid-cols-5 gap-3 px-5 py-4 text-sm items-center">
                      <span className="font-medium text-[#0a0a0a]">{p.name}</span>
                      <span className="text-[#6b6b6b] font-mono text-xs">{p.type}</span>
                      <span>
                        {p.status === 'active' ? (
                          <Badge className="bg-[#0a0a0a] text-white border-transparent text-xs">Active</Badge>
                        ) : (
                          <Badge className="border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs">Disconnected</Badge>
                        )}
                      </span>
                      <span className="text-[#6b6b6b] font-mono text-xs">{p.cost}</span>
                      <span>
                        <Button size="sm" variant="outline" className="h-7 text-xs">Configure</Button>
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">BYOT Call Flow</CardTitle>
                <CardDescription>Session anonymization is always ON. Voice AI never receives real phone numbers.</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm text-[#6b6b6b]">
                  {[
                    'Generate anonymized session_id = uuid()',
                    'Store mapping server-side: session_id → { contact_id, phone, campaign_id }',
                    'Initiate call via telephony provider (Twilio/Telnyx) using real phone number',
                    'Bridge audio stream to Voice AI using only session_id',
                    'Voice AI receives: audio + agent config only — no phone number, no contact surname',
                    'Dynamic variables use generic labels: contact_ref="C-4872", greeting_name="Juan"',
                    'On call end: webhook → map session_id → store results in Supabase',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] text-white text-xs font-bold">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 3 — Cost Dashboard */}
        {tab === 'costs' && (
          <div className="space-y-4">
            <p className="text-sm text-[#6b6b6b]">Internal cost visibility — never shown to clients. Shows margin per workspace and infrastructure spend.</p>

            {/* Summary KPIs */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total Infrastructure Cost', value: `$${MOCK_WORKSPACE_COSTS.reduce((s, w) => s + w.providerCost, 0).toFixed(2)}`, sub: 'This month' },
                { label: 'Total Revenue', value: `$${MOCK_WORKSPACE_COSTS.reduce((s, w) => s + w.planRevenue, 0).toFixed(2)}`, sub: 'Subscription + overage' },
                { label: 'Gross Margin', value: (() => {
                  const rev = MOCK_WORKSPACE_COSTS.reduce((s, w) => s + w.planRevenue, 0);
                  const cost = MOCK_WORKSPACE_COSTS.reduce((s, w) => s + w.providerCost, 0);
                  return `${(((rev - cost) / rev) * 100).toFixed(1)}%`;
                })(), sub: 'Revenue minus provider cost' },
                { label: 'Active Workspaces', value: String(MOCK_WORKSPACE_COSTS.filter(w => w.minutesUsed > 0).length), sub: 'With usage this month' },
              ].map(m => (
                <Card key={m.label}>
                  <CardContent className="p-5">
                    <p className="text-sm text-[#6b6b6b] mb-2">{m.label}</p>
                    <p className="text-2xl font-bold text-[#0a0a0a]">{m.value}</p>
                    <p className="text-xs text-[#6b6b6b] mt-1">{m.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Per-workspace breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Per-Workspace Margin</CardTitle>
                <CardDescription>Cost, revenue, and margin by workspace. Internal only.</CardDescription>
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
                      <div key={w.name} className="grid grid-cols-6 gap-3 px-5 py-3 text-sm items-center hover:bg-[#f5f5f5]">
                        <span className="col-span-2 font-medium text-[#0a0a0a]">{w.name}</span>
                        <span className="capitalize text-[#6b6b6b]">{w.plan}</span>
                        <span className="text-right">${w.planRevenue}</span>
                        <span className="text-right text-[#6b6b6b]">${w.providerCost.toFixed(2)}</span>
                        <span className={`text-right font-medium ${margin < 0 ? 'text-red-600' : 'text-[#0a0a0a]'}`}>
                          {margin < 0 ? '-' : '+'}${Math.abs(margin).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 4 — Provider Health */}
        {tab === 'health' && (
          <div className="space-y-4">
            <p className="text-sm text-[#6b6b6b]">Real-time provider status. Configure automatic failover rules below.</p>

            <div className="grid grid-cols-1 gap-4">
              {PROVIDER_HEALTH.map((p) => (
                <Card key={p.name}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatusDot status={p.status} />
                        <div>
                          <p className="font-medium text-[#0a0a0a] text-sm">{p.name}</p>
                          <p className="text-xs text-[#6b6b6b]">{p.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8 text-sm">
                        <div className="text-center">
                          <p className="text-xs text-[#6b6b6b] mb-0.5">Latency (24h avg)</p>
                          <p className={`font-medium ${p.latency > 300 ? 'text-yellow-600' : 'text-[#0a0a0a]'}`}>{p.latency} ms</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-[#6b6b6b] mb-0.5">Error Rate</p>
                          <p className={`font-medium ${p.errorRate > 1 ? 'text-red-600' : 'text-[#0a0a0a]'}`}>{p.errorRate}%</p>
                        </div>
                        <div>
                          {p.status === 'operational' ? (
                            <Badge className="bg-[#0a0a0a] text-white border-transparent text-xs flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Operational
                            </Badge>
                          ) : p.status === 'degraded' ? (
                            <Badge className="bg-yellow-500 text-white border-transparent text-xs flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Degraded
                            </Badge>
                          ) : (
                            <Badge className="bg-red-600 text-white border-transparent text-xs flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Down
                            </Badge>
                          )}
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-xs">Force Override</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Failover Rules</CardTitle>
                <CardDescription>Automatic routing when a provider degrades or goes down.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {[
                    { trigger: 'ElevenLabs error rate > 5%',  action: 'Switch Standard Voice → Cartesia Sonic-3' },
                    { trigger: 'Cartesia latency > 500ms',    action: 'Switch Ultra-Fast → Deepgram STT bridge' },
                    { trigger: 'Twilio error rate > 3%',      action: 'Switch telephony → Telnyx' },
                    { trigger: 'Telnyx down > 60s',           action: 'Switch telephony → Twilio' },
                  ].map((rule, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-[#f5f5f5] px-4 py-3">
                      <div>
                        <p className="text-xs font-medium text-[#6b6b6b] uppercase tracking-wide mb-0.5">Trigger</p>
                        <p>{rule.trigger}</p>
                      </div>
                      <span className="text-[#6b6b6b] mx-4">→</span>
                      <div className="text-right">
                        <p className="text-xs font-medium text-[#6b6b6b] uppercase tracking-wide mb-0.5">Action</p>
                        <p>{rule.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
