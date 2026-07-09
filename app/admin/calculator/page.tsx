"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Calculator, Save, RefreshCw } from "lucide-react";
import {
  type ProviderCosts,
  DEFAULTS,
  TOKENS_PER_MIN,
  CHARS_PER_MIN,
  computeCOGS,
  fmtUSD,
} from "./_components/pricing";
import { ProviderCostsCard } from "./_components/ProviderCostsCard";
import { CallSimulator } from "./_components/CallSimulator";
import { SummaryCards } from "./_components/SummaryCards";
import { BreakdownTable } from "./_components/BreakdownTable";

export default function CalculatorPage() {
  const [costs, setCosts] = useState<ProviderCosts>(DEFAULTS);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [durMin, setDurMin] = useState(3);
  const [pricePerMin, setPricePerMin] = useState(0.05); // USD/min

  const loadCosts = useCallback(async () => {
    const res = await fetch("/api/admin/provider-costs");
    if (res.ok) {
      const data = (await res.json()) as Partial<ProviderCosts>;
      setCosts({ ...DEFAULTS, ...data });
    }
  }, []);

  useEffect(() => {
    loadCosts();
  }, [loadCosts]);

  function setCostField(key: keyof ProviderCosts, raw: string) {
    const val = parseFloat(raw);
    if (!Number.isFinite(val) || val < 0) return;
    setCosts((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
  }

  async function saveCosts() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/provider-costs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(costs),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Costos guardados correctamente");
      setDirty(false);
    } catch {
      toast.error("Error al guardar los costos");
    } finally {
      setSaving(false);
    }
  }

  const cogs = computeCOGS(costs, durMin);
  const revenue = pricePerMin * durMin;
  const gross = revenue - cogs;
  const grossPct = revenue > 0 ? (gross / revenue) * 100 : 0;
  // Precio mínimo para alcanzar 50% de margen
  const breakEven = durMin > 0 ? (cogs / durMin) * 2 : 0;

  const breakdown = [
    {
      nombre: "Twilio (telefonía)",
      costo: costs.twilio_outbound_per_min * durMin,
      tasa: `${fmtUSD(costs.twilio_outbound_per_min)}/min`,
    },
    {
      nombre: "Deepgram (STT)",
      costo: costs.stt_per_min * durMin,
      tasa: `${fmtUSD(costs.stt_per_min)}/min`,
    },
    {
      nombre: "LLM",
      costo: costs.llm_per_1k_tokens * ((TOKENS_PER_MIN * durMin) / 1000),
      tasa: `${fmtUSD(costs.llm_per_1k_tokens)}/1k tok`,
    },
    {
      nombre: "Cartesia (TTS)",
      costo: costs.tts_per_1k_chars * ((CHARS_PER_MIN * durMin) / 1000),
      tasa: `${fmtUSD(costs.tts_per_1k_chars)}/1k chars`,
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            Calculadora de Márgenes
          </h1>
          <p className="text-sm text-[#6b6b6b] mt-1">
            Precios oficiales 2025 · Todos los valores en USD
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadCosts}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Recargar
          </Button>
          <Button
            size="sm"
            onClick={saveCosts}
            disabled={!dirty || saving}
            className="bg-[#0a0a0a] text-white hover:bg-[#262626]"
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving ? "Guardando…" : "Guardar costos"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProviderCostsCard costs={costs} onChange={setCostField} />
        <CallSimulator
          durMin={durMin}
          setDurMin={setDurMin}
          pricePerMin={pricePerMin}
          setPricePerMin={setPricePerMin}
          cogs={cogs}
          revenue={revenue}
          gross={gross}
          grossPct={grossPct}
        />
      </div>

      <SummaryCards
        breakEven={breakEven}
        grossPct={grossPct}
        pricePerMin={pricePerMin}
        cogs={cogs}
        durMin={durMin}
      />

      <BreakdownTable breakdown={breakdown} cogs={cogs} durMin={durMin} />
    </div>
  );
}
