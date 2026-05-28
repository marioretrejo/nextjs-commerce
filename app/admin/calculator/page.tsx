'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Calculator, Save, RefreshCw, DollarSign, TrendingUp } from 'lucide-react';

interface ProviderCosts {
  twilio_outbound_per_min: number;
  twilio_inbound_per_min:  number;
  livekit_per_min:         number;
  stt_per_min:             number;
  llm_per_1k_tokens:       number;
  tts_per_1k_chars:        number;
}

const DEFAULTS: ProviderCosts = {
  twilio_outbound_per_min: 0.85,
  twilio_inbound_per_min:  0.85,
  livekit_per_min:         0.20,
  stt_per_min:             0.59,
  llm_per_1k_tokens:       0.06,
  tts_per_1k_chars:        0.65,
};

const COST_FIELDS: { key: keyof ProviderCosts; label: string; unit: string; hint: string }[] = [
  { key: 'twilio_outbound_per_min', label: 'Twilio Outbound',  unit: '¢/min',        hint: 'Carrier cost per outbound call minute' },
  { key: 'twilio_inbound_per_min',  label: 'Twilio Inbound',   unit: '¢/min',        hint: 'Carrier cost per inbound call minute' },
  { key: 'livekit_per_min',         label: 'LiveKit WebRTC',   unit: '¢/min',        hint: 'Per participant per minute (browser calls)' },
  { key: 'stt_per_min',             label: 'STT (Deepgram)',   unit: '¢/min',        hint: 'Nova-3 streaming transcription' },
  { key: 'llm_per_1k_tokens',       label: 'LLM (Groq)',       unit: '¢/1k tokens',  hint: 'Llama 4 Scout inference tokens' },
  { key: 'tts_per_1k_chars',        label: 'TTS (Cartesia)',   unit: '¢/1k chars',   hint: 'Sonic-3 synthesis characters' },
];

// Simulate a call at given duration + token/char estimates
function computeCOGS(costs: ProviderCosts, sim: SimParams): number {
  const twilio    = costs.twilio_outbound_per_min * sim.durationMin;
  const livekit   = costs.livekit_per_min * sim.durationMin * (sim.isBrowser ? 1 : 0);
  const stt       = costs.stt_per_min * sim.durationMin;
  const llm       = costs.llm_per_1k_tokens * (sim.tokensPerMin * sim.durationMin / 1000);
  const tts       = costs.tts_per_1k_chars * (sim.charsPerMin * sim.durationMin / 1000);
  return twilio + livekit + stt + llm + tts;
}

interface SimParams {
  durationMin:  number;
  isBrowser:    boolean;
  tokensPerMin: number;
  charsPerMin:  number;
  pricePerMin:  number;
  marginTarget: number;
}

const SIM_DEFAULTS: SimParams = {
  durationMin:  3,
  isBrowser:    false,
  tokensPerMin: 300,
  charsPerMin:  800,
  pricePerMin:  5.0,
  marginTarget: 50,
};

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(4)}`;
}

function fmtCurrency(cents: number): string {
  if (Math.abs(cents) < 1) return `${cents.toFixed(2)}¢`;
  return `$${(cents / 100).toFixed(4)}`;
}

export default function CalculatorPage() {
  const [costs, setCosts]       = useState<ProviderCosts>(DEFAULTS);
  const [dirty, setDirty]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [sim, setSim]           = useState<SimParams>(SIM_DEFAULTS);

  const loadCosts = useCallback(async () => {
    const res = await fetch('/api/admin/provider-costs');
    if (res.ok) {
      const data = await res.json() as Partial<ProviderCosts>;
      setCosts({ ...DEFAULTS, ...data });
    }
  }, []);

  useEffect(() => { loadCosts(); }, [loadCosts]);

  function setCostField(key: keyof ProviderCosts, raw: string) {
    const val = parseFloat(raw);
    if (!Number.isFinite(val) || val < 0) return;
    setCosts(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  }

  async function saveCosts() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/provider-costs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(costs),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Provider costs saved');
      setDirty(false);
    } catch {
      toast.error('Failed to save costs');
    } finally {
      setSaving(false);
    }
  }

  const cogs      = computeCOGS(costs, sim);
  const revenue   = sim.pricePerMin * sim.durationMin;
  const gross     = revenue - cogs;
  const grossPct  = revenue > 0 ? (gross / revenue) * 100 : 0;

  const breakEvenPrice = sim.durationMin > 0
    ? cogs / sim.durationMin / (1 - sim.marginTarget / 100)
    : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            Unit Economics Calculator
          </h1>
          <p className="text-sm text-[#6b6b6b] mt-1">Configure provider costs and simulate call-level margins</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadCosts}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reload
          </Button>
          <Button size="sm" onClick={saveCosts} disabled={!dirty || saving} className="bg-[#0a0a0a] text-white hover:bg-[#262626]">
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving ? 'Saving…' : 'Save costs'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Provider cost editor */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Provider Costs</CardTitle>
            <CardDescription>All values in US cents. Saved globally — affects all margin calculations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {COST_FIELDS.map(({ key, label, unit, hint }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs font-medium text-[#0a0a0a]">
                  {label}
                  <span className="ml-1.5 text-[#6b6b6b] font-normal">({unit})</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costs[key]}
                    onChange={e => setCostField(key, e.target.value)}
                    className="h-8 text-sm w-28"
                  />
                  <span className="text-xs text-[#6b6b6b]">{hint}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Call simulator */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Call Simulator</CardTitle>
            <CardDescription>Estimate COGS and gross margin for a typical call</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Duration (minutes)</Label>
                <Input type="number" min="0.1" step="0.5" value={sim.durationMin}
                  onChange={e => setSim(p => ({ ...p, durationMin: Math.max(0.1, parseFloat(e.target.value) || 1) }))}
                  className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Sell price (¢/min)</Label>
                <Input type="number" min="0" step="0.5" value={sim.pricePerMin}
                  onChange={e => setSim(p => ({ ...p, pricePerMin: parseFloat(e.target.value) || 0 }))}
                  className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">LLM tokens / min</Label>
                <Input type="number" min="0" step="10" value={sim.tokensPerMin}
                  onChange={e => setSim(p => ({ ...p, tokensPerMin: parseInt(e.target.value) || 0 }))}
                  className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">TTS chars / min</Label>
                <Input type="number" min="0" step="50" value={sim.charsPerMin}
                  onChange={e => setSim(p => ({ ...p, charsPerMin: parseInt(e.target.value) || 0 }))}
                  className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Target margin (%)</Label>
                <Input type="number" min="1" max="99" step="1" value={sim.marginTarget}
                  onChange={e => setSim(p => ({ ...p, marginTarget: Math.min(99, parseInt(e.target.value) || 50) }))}
                  className="h-8 text-sm mt-1" />
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={sim.isBrowser}
                    onChange={e => setSim(p => ({ ...p, isBrowser: e.target.checked }))}
                    className="rounded" />
                  Include LiveKit (browser)
                </label>
              </div>
            </div>

            {/* Results */}
            <div className="mt-2 rounded-lg border border-[#e0e0e0] divide-y divide-[#e0e0e0]">
              {[
                { label: 'COGS (total)',    value: fmtCurrency(cogs),    sub: `${fmtCurrency(cogs / (sim.durationMin || 1))} / min`, color: 'text-red-600' },
                { label: 'Revenue',         value: fmtCurrency(revenue), sub: `${fmtCurrency(sim.pricePerMin)} / min`,               color: 'text-[#0a0a0a]' },
                { label: 'Gross profit',    value: fmtCurrency(gross),   sub: `${grossPct.toFixed(1)}% margin`,                       color: gross >= 0 ? 'text-green-600' : 'text-red-600' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-[#6b6b6b]">{row.label}</span>
                  <div className="text-right">
                    <span className={`text-sm font-semibold ${row.color}`}>{row.value}</span>
                    <span className="block text-[10px] text-[#6b6b6b]">{row.sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing recommendation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Break-even price',    value: `${breakEvenPrice.toFixed(2)}¢/min`, sub: `${sim.marginTarget}% margin target`,                    icon: <DollarSign className="h-4 w-4" />, color: 'text-[#0a0a0a]' },
          { label: 'Gross margin',        value: `${grossPct.toFixed(1)}%`,            sub: `At ${fmt(sim.pricePerMin * 100)}/min sell price`,         icon: <TrendingUp className="h-4 w-4" />, color: grossPct >= 40 ? 'text-green-600' : 'text-amber-600' },
          { label: 'COGS per minute',     value: fmtCurrency(cogs / (sim.durationMin || 1)), sub: 'All providers combined',                            icon: <Calculator className="h-4 w-4" />, color: 'text-[#0a0a0a]' },
        ].map(card => (
          <Card key={card.label}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#f5f5f5] flex items-center justify-center shrink-0">
                {card.icon}
              </div>
              <div>
                <p className="text-xs text-[#6b6b6b]">{card.label}</p>
                <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                <p className="text-[10px] text-[#6b6b6b]">{card.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* COGS breakdown table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">COGS Breakdown — per call</CardTitle>
          <CardDescription>At {sim.durationMin} min · {sim.tokensPerMin} tok/min · {sim.charsPerMin} chars/min</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e0e0e0] text-xs text-[#6b6b6b] uppercase tracking-wide">
                <th className="text-left px-5 py-2 font-medium">Component</th>
                <th className="text-right px-5 py-2 font-medium">Rate</th>
                <th className="text-right px-5 py-2 font-medium">This call</th>
                <th className="text-right px-5 py-2 font-medium">% of COGS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e0e0]">
              {[
                { name: 'Twilio (telephony)',    cost: costs.twilio_outbound_per_min * sim.durationMin,                                      rate: `${costs.twilio_outbound_per_min}¢/min` },
                { name: 'LiveKit (WebRTC)',       cost: sim.isBrowser ? costs.livekit_per_min * sim.durationMin : 0,                          rate: `${costs.livekit_per_min}¢/min` },
                { name: 'STT (Deepgram)',         cost: costs.stt_per_min * sim.durationMin,                                                  rate: `${costs.stt_per_min}¢/min` },
                { name: 'LLM (Groq)',             cost: costs.llm_per_1k_tokens * (sim.tokensPerMin * sim.durationMin / 1000),                rate: `${costs.llm_per_1k_tokens}¢/1k tok` },
                { name: 'TTS (Cartesia)',         cost: costs.tts_per_1k_chars * (sim.charsPerMin * sim.durationMin / 1000),                  rate: `${costs.tts_per_1k_chars}¢/1k chars` },
              ].map(row => (
                <tr key={row.name} className="hover:bg-[#f9f9f9]">
                  <td className="px-5 py-2.5 text-[#0a0a0a] font-medium">{row.name}</td>
                  <td className="px-5 py-2.5 text-right text-[#6b6b6b]">{row.rate}</td>
                  <td className="px-5 py-2.5 text-right font-medium">{fmtCurrency(row.cost)}</td>
                  <td className="px-5 py-2.5 text-right text-[#6b6b6b]">
                    {cogs > 0 ? `${((row.cost / cogs) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#0a0a0a] bg-[#f5f5f5] font-semibold">
                <td className="px-5 py-2.5">Total COGS</td>
                <td className="px-5 py-2.5 text-right text-[#6b6b6b]">{fmtCurrency(cogs / (sim.durationMin || 1))}/min</td>
                <td className="px-5 py-2.5 text-right">{fmtCurrency(cogs)}</td>
                <td className="px-5 py-2.5 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
