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
  { key: 'twilio_outbound_per_min', label: 'Twilio Saliente',  unit: '¢/min',          hint: 'Costo del operador por minuto de llamada saliente' },
  { key: 'twilio_inbound_per_min',  label: 'Twilio Entrante',  unit: '¢/min',          hint: 'Costo del operador por minuto de llamada entrante' },
  { key: 'livekit_per_min',         label: 'LiveKit WebRTC',   unit: '¢/min',          hint: 'Por participante/minuto (llamadas desde navegador)' },
  { key: 'stt_per_min',             label: 'STT (Deepgram)',   unit: '¢/min',          hint: 'Transcripción en tiempo real Nova-3' },
  { key: 'llm_per_1k_tokens',       label: 'LLM (Groq)',       unit: '¢/1k tokens',    hint: 'Inferencia Llama 4 Scout' },
  { key: 'tts_per_1k_chars',        label: 'TTS (Cartesia)',   unit: '¢/1k caracteres', hint: 'Síntesis de voz Sonic-3' },
];

// Tokens/chars por minuto — promedio fijo para simplificar
const TOKENS_PER_MIN = 300;
const CHARS_PER_MIN  = 800;

function computeCOGS(costs: ProviderCosts, durationMin: number): number {
  return (
    costs.twilio_outbound_per_min * durationMin +
    costs.stt_per_min             * durationMin +
    costs.llm_per_1k_tokens       * (TOKENS_PER_MIN * durationMin / 1000) +
    costs.tts_per_1k_chars        * (CHARS_PER_MIN  * durationMin / 1000)
  );
}

function fmtCents(cents: number): string {
  if (Math.abs(cents) < 1) return `${cents.toFixed(2)}¢`;
  return `$${(cents / 100).toFixed(4)}`;
}

export default function CalculatorPage() {
  const [costs, setCosts]   = useState<ProviderCosts>(DEFAULTS);
  const [dirty, setDirty]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [durMin, setDurMin] = useState(3);
  const [pricePerMin, setPricePerMin] = useState(5);

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
      toast.success('Costos guardados correctamente');
      setDirty(false);
    } catch {
      toast.error('Error al guardar los costos');
    } finally {
      setSaving(false);
    }
  }

  const cogs     = computeCOGS(costs, durMin);
  const revenue  = pricePerMin * durMin;
  const gross    = revenue - cogs;
  const grossPct = revenue > 0 ? (gross / revenue) * 100 : 0;
  const breakEven = durMin > 0 ? (cogs / durMin) * (100 / 50) : 0; // precio para 50% margen

  const breakdown = [
    { nombre: 'Twilio (telefonía)',  costo: costs.twilio_outbound_per_min * durMin, tasa: `${costs.twilio_outbound_per_min}¢/min` },
    { nombre: 'STT (Deepgram)',      costo: costs.stt_per_min * durMin,             tasa: `${costs.stt_per_min}¢/min` },
    { nombre: 'LLM (Groq)',          costo: costs.llm_per_1k_tokens * (TOKENS_PER_MIN * durMin / 1000), tasa: `${costs.llm_per_1k_tokens}¢/1k tok` },
    { nombre: 'TTS (Cartesia)',      costo: costs.tts_per_1k_chars * (CHARS_PER_MIN * durMin / 1000),   tasa: `${costs.tts_per_1k_chars}¢/1k chars` },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            Calculadora de Márgenes
          </h1>
          <p className="text-sm text-[#6b6b6b] mt-1">Configura los costos de proveedores y simula el margen por llamada</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadCosts}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Recargar
          </Button>
          <Button size="sm" onClick={saveCosts} disabled={!dirty || saving} className="bg-[#0a0a0a] text-white hover:bg-[#262626]">
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving ? 'Guardando…' : 'Guardar costos'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Costos de proveedores */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Costos de Proveedores</CardTitle>
            <CardDescription>Valores en centavos de dólar. Se aplican a todos los cálculos de margen.</CardDescription>
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

        {/* Simulador simplificado */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Simulador de Llamada</CardTitle>
            <CardDescription>Ingresa la duración y tu precio de venta para ver el margen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Duración (minutos)</Label>
                <Input type="number" min="0.1" step="0.5" value={durMin}
                  onChange={e => setDurMin(Math.max(0.1, parseFloat(e.target.value) || 1))}
                  className="h-9 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Precio de venta (¢/min)</Label>
                <Input type="number" min="0" step="0.5" value={pricePerMin}
                  onChange={e => setPricePerMin(parseFloat(e.target.value) || 0)}
                  className="h-9 text-sm mt-1" />
              </div>
            </div>

            {/* Resultados */}
            <div className="rounded-lg border border-[#e0e0e0] divide-y divide-[#e0e0e0]">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#6b6b6b]">Costo total (COGS)</span>
                <div className="text-right">
                  <span className="text-base font-bold text-red-600">{fmtCents(cogs)}</span>
                  <span className="block text-[11px] text-[#6b6b6b]">{fmtCents(cogs / durMin)}/min</span>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#6b6b6b]">Ingreso</span>
                <div className="text-right">
                  <span className="text-base font-bold text-[#0a0a0a]">{fmtCents(revenue)}</span>
                  <span className="block text-[11px] text-[#6b6b6b]">{fmtCents(pricePerMin)}/min</span>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-[#fafafa] rounded-b-lg">
                <span className="text-sm font-medium text-[#0a0a0a]">Ganancia bruta</span>
                <div className="text-right">
                  <span className={`text-lg font-bold ${gross >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtCents(gross)}</span>
                  <span className="block text-[11px] text-[#6b6b6b]">{grossPct.toFixed(1)}% de margen</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Precio de equilibrio',
            value: `${breakEven.toFixed(2)}¢/min`,
            sub: 'Para alcanzar 50% de margen',
            icon: <DollarSign className="h-4 w-4" />,
            color: 'text-[#0a0a0a]',
          },
          {
            label: 'Margen bruto',
            value: `${grossPct.toFixed(1)}%`,
            sub: `Con precio de ${fmtCents(pricePerMin)}/min`,
            icon: <TrendingUp className="h-4 w-4" />,
            color: grossPct >= 40 ? 'text-green-600' : 'text-amber-600',
          },
          {
            label: 'Costo por minuto',
            value: fmtCents(cogs / durMin),
            sub: 'Todos los proveedores combinados',
            icon: <Calculator className="h-4 w-4" />,
            color: 'text-[#0a0a0a]',
          },
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

      {/* Tabla de desglose */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Desglose de Costos — por llamada</CardTitle>
          <CardDescription>Para una llamada de {durMin} minutos</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e0e0e0] text-xs text-[#6b6b6b] uppercase tracking-wide">
                <th className="text-left px-5 py-2 font-medium">Componente</th>
                <th className="text-right px-5 py-2 font-medium">Tarifa</th>
                <th className="text-right px-5 py-2 font-medium">Esta llamada</th>
                <th className="text-right px-5 py-2 font-medium">% del costo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e0e0]">
              {breakdown.map(row => (
                <tr key={row.nombre} className="hover:bg-[#f9f9f9]">
                  <td className="px-5 py-2.5 text-[#0a0a0a] font-medium">{row.nombre}</td>
                  <td className="px-5 py-2.5 text-right text-[#6b6b6b]">{row.tasa}</td>
                  <td className="px-5 py-2.5 text-right font-medium">{fmtCents(row.costo)}</td>
                  <td className="px-5 py-2.5 text-right text-[#6b6b6b]">
                    {cogs > 0 ? `${((row.costo / cogs) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#0a0a0a] bg-[#f5f5f5] font-semibold">
                <td className="px-5 py-2.5">Total</td>
                <td className="px-5 py-2.5 text-right text-[#6b6b6b]">{fmtCents(cogs / durMin)}/min</td>
                <td className="px-5 py-2.5 text-right">{fmtCents(cogs)}</td>
                <td className="px-5 py-2.5 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
