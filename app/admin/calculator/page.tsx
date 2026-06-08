'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Calculator, Save, RefreshCw, DollarSign, TrendingUp, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ProviderCosts {
  twilio_outbound_per_min: number;
  twilio_inbound_per_min:  number;
  livekit_per_min:         number;
  stt_per_min:             number;
  llm_per_1k_tokens:       number;
  tts_per_1k_chars:        number;
}

// Precios oficiales 2025 en USD
// Twilio: $0.014/min (twilio.com/en-us/voice/pricing/us)
// Deepgram Nova-3 streaming: $0.0077/min (deepgram.com/pricing)
// Cartesia Sonic-3: $50/1M chars = $0.05/1k chars (cartesia.ai/pricing)
// Groq Llama 4 Scout: $0.11/1M input + $0.34/1M output ≈ $0.000225/1k tok blended
// LiveKit Cloud: $0.0005/participant-min (livekit.io/pricing)
const DEFAULTS: ProviderCosts = {
  twilio_outbound_per_min: 0.0140,
  twilio_inbound_per_min:  0.0140,
  livekit_per_min:         0.0005,
  stt_per_min:             0.0077,
  llm_per_1k_tokens:       0.000225,
  tts_per_1k_chars:        0.0500,
};

const COST_FIELDS: { key: keyof ProviderCosts; label: string; unit: string; hint: string; how: string }[] = [
  {
    key: 'twilio_outbound_per_min', label: 'Twilio Saliente', unit: '$/min',
    hint: 'twilio.com/en-us/voice/pricing/us',
    how: 'Cobra por minuto conectado desde que el destinatario contesta hasta que cuelga. Precio oficial para llamadas salientes a EE.UU.: $0.014/min. Se factura en fracciones de segundo.',
  },
  {
    key: 'twilio_inbound_per_min', label: 'Twilio Entrante', unit: '$/min',
    hint: 'twilio.com/en-us/voice/pricing/us',
    how: 'Mismo modelo que saliente pero para llamadas que recibe tu número. $0.014/min para números de EE.UU. Se suma al costo de renta del número (~$1.15/mes).',
  },
  {
    key: 'livekit_per_min', label: 'LiveKit WebRTC', unit: '$/min',
    hint: 'livekit.io/pricing — por participante/min',
    how: 'Cobra por participante × minuto de media (audio/video) procesada. $0.0005/participante/min en plan pagado. Solo aplica en llamadas desde navegador; las llamadas telefónicas SIP tienen tarifa separada.',
  },
  {
    key: 'stt_per_min', label: 'Deepgram Nova-3', unit: '$/min',
    hint: 'deepgram.com/pricing — STT streaming',
    how: 'Cobra por minuto de audio enviado al modelo de transcripción, se factura aunque haya silencio. Nova-3 Streaming (tiempo real): $0.0077/min en PAYG. Plan Growth baja a $0.0065/min.',
  },
  {
    key: 'llm_per_1k_tokens', label: 'Groq · Llama 4 Scout', unit: '$/1k tokens',
    hint: 'groq.com/pricing — promedio input+output',
    how: 'Cobra por tokens procesados: $0.11/1M tokens de entrada + $0.34/1M tokens de salida. El valor configurado ($0.000225/1k) es un promedio blended asumiendo ~50% input / 50% output. Es el proveedor más barato del stack.',
  },
  {
    key: 'tts_per_1k_chars', label: 'Cartesia Sonic-3', unit: '$/1k chars',
    hint: 'cartesia.ai/pricing — $50/1M chars',
    how: 'Cobra por cada carácter de texto que el agente convierte a voz. Precio oficial: $50 por 1,000,000 caracteres = $0.05 por cada 1,000 chars. A 800 chars/min en una llamada de 3 min = $0.12. Es el componente más costoso del stack.',
  },
];

// Promedios fijos de consumo por minuto
const TOKENS_PER_MIN = 300;
const CHARS_PER_MIN  = 800;

// Todos los valores son USD — retorna USD
function computeCOGS(costs: ProviderCosts, durationMin: number): number {
  return (
    costs.twilio_outbound_per_min * durationMin +
    costs.stt_per_min             * durationMin +
    costs.llm_per_1k_tokens       * (TOKENS_PER_MIN * durationMin / 1000) +
    costs.tts_per_1k_chars        * (CHARS_PER_MIN  * durationMin / 1000)
  );
}

function fmtUSD(usd: number): string {
  if (usd === 0) return '$0.00';
  if (Math.abs(usd) < 0.001)  return `$${usd.toFixed(5)}`;
  if (Math.abs(usd) < 0.01)   return `$${usd.toFixed(4)}`;
  if (Math.abs(usd) < 1)      return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export default function CalculatorPage() {
  const [costs, setCosts]   = useState<ProviderCosts>(DEFAULTS);
  const [dirty, setDirty]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [durMin, setDurMin] = useState(3);
  const [pricePerMin, setPricePerMin] = useState(0.05); // USD/min

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
  // Precio mínimo para alcanzar 50% de margen
  const breakEven = durMin > 0 ? (cogs / durMin) * 2 : 0;

  const breakdown = [
    { nombre: 'Twilio (telefonía)',  costo: costs.twilio_outbound_per_min * durMin,                             tasa: `${fmtUSD(costs.twilio_outbound_per_min)}/min` },
    { nombre: 'Deepgram (STT)',      costo: costs.stt_per_min * durMin,                                         tasa: `${fmtUSD(costs.stt_per_min)}/min` },
    { nombre: 'Groq (LLM)',          costo: costs.llm_per_1k_tokens * (TOKENS_PER_MIN * durMin / 1000),         tasa: `${fmtUSD(costs.llm_per_1k_tokens)}/1k tok` },
    { nombre: 'Cartesia (TTS)',      costo: costs.tts_per_1k_chars * (CHARS_PER_MIN * durMin / 1000),           tasa: `${fmtUSD(costs.tts_per_1k_chars)}/1k chars` },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            Calculadora de Márgenes
          </h1>
          <p className="text-sm text-[#6b6b6b] mt-1">Precios oficiales 2025 · Todos los valores en USD</p>
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
            <CardDescription>Valores en USD — precios oficiales de cada proveedor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TooltipProvider delayDuration={0}>
              {COST_FIELDS.map(({ key, label, unit, hint, how }) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-medium text-[#0a0a0a]">
                      {label}
                      <span className="ml-1.5 text-[#6b6b6b] font-normal">({unit})</span>
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-[#a0a0a0] hover:text-[#0a0a0a] transition-colors">
                          <HelpCircle className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs leading-relaxed">
                        <p className="font-medium mb-1">{label}</p>
                        <p className="text-[#6b6b6b]">{how}</p>
                        <p className="mt-1.5 text-[#a0a0a0] italic">{hint}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#6b6b6b] pointer-events-none select-none">$</span>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={costs[key]}
                        onChange={e => setCostField(key, e.target.value)}
                        className="h-8 text-sm w-32 font-mono pl-5"
                      />
                    </div>
                    <span className="text-xs text-[#6b6b6b]">{hint}</span>
                  </div>
                </div>
              ))}
            </TooltipProvider>
          </CardContent>
        </Card>

        {/* Simulador */}
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
                <Label className="text-xs">Precio de venta (USD/min)</Label>
                <div className="relative mt-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#6b6b6b] pointer-events-none select-none">$</span>
                  <Input type="number" min="0" step="0.01" value={pricePerMin}
                    onChange={e => setPricePerMin(parseFloat(e.target.value) || 0)}
                    className="h-9 text-sm font-mono pl-5" />
                </div>
              </div>
            </div>

            {/* Resultados */}
            <div className="rounded-lg border border-[#e0e0e0] divide-y divide-[#e0e0e0]">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#6b6b6b]">Costo total (COGS)</span>
                <div className="text-right">
                  <span className="text-base font-bold text-red-600">{fmtUSD(cogs)}</span>
                  <span className="block text-[11px] text-[#6b6b6b]">{fmtUSD(cogs / durMin)}/min</span>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#6b6b6b]">Ingreso</span>
                <div className="text-right">
                  <span className="text-base font-bold text-[#0a0a0a]">{fmtUSD(revenue)}</span>
                  <span className="block text-[11px] text-[#6b6b6b]">{fmtUSD(pricePerMin)}/min</span>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-[#fafafa] rounded-b-lg">
                <span className="text-sm font-medium text-[#0a0a0a]">Ganancia bruta</span>
                <div className="text-right">
                  <span className={`text-lg font-bold ${gross >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtUSD(gross)}</span>
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
            label: 'Precio de equilibrio (50% margen)',
            value: `${fmtUSD(breakEven)}/min`,
            sub: 'Mínimo para ser rentable',
            icon: <DollarSign className="h-4 w-4" />,
            color: 'text-[#0a0a0a]',
          },
          {
            label: 'Margen bruto',
            value: `${grossPct.toFixed(1)}%`,
            sub: `Con precio de ${fmtUSD(pricePerMin)}/min`,
            icon: <TrendingUp className="h-4 w-4" />,
            color: grossPct >= 40 ? 'text-green-600' : grossPct >= 0 ? 'text-amber-600' : 'text-red-600',
          },
          {
            label: 'Costo por minuto',
            value: fmtUSD(cogs / durMin),
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
          <CardDescription>Para una llamada de {durMin} min · estimado {TOKENS_PER_MIN} tok/min · {CHARS_PER_MIN} chars/min</CardDescription>
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
                  <td className="px-5 py-2.5 text-right text-[#6b6b6b] font-mono text-xs">{row.tasa}</td>
                  <td className="px-5 py-2.5 text-right font-mono font-medium">{fmtUSD(row.costo)}</td>
                  <td className="px-5 py-2.5 text-right text-[#6b6b6b]">
                    {cogs > 0 ? `${((row.costo / cogs) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#0a0a0a] bg-[#f5f5f5] font-semibold">
                <td className="px-5 py-2.5">Total</td>
                <td className="px-5 py-2.5 text-right text-[#6b6b6b] font-mono text-xs">{fmtUSD(cogs / durMin)}/min</td>
                <td className="px-5 py-2.5 text-right font-mono">{fmtUSD(cogs)}</td>
                <td className="px-5 py-2.5 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
