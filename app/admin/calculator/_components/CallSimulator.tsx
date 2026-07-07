import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtUSD } from "./pricing";

export function CallSimulator({
  durMin,
  setDurMin,
  pricePerMin,
  setPricePerMin,
  cogs,
  revenue,
  gross,
  grossPct,
}: {
  durMin: number;
  setDurMin: (v: number) => void;
  pricePerMin: number;
  setPricePerMin: (v: number) => void;
  cogs: number;
  revenue: number;
  gross: number;
  grossPct: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Simulador de Llamada</CardTitle>
        <CardDescription>
          Ingresa la duración y tu precio de venta para ver el margen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Duración (minutos)</Label>
            <Input
              type="number"
              min="0.1"
              step="0.5"
              value={durMin}
              onChange={(e) =>
                setDurMin(Math.max(0.1, parseFloat(e.target.value) || 1))
              }
              className="h-9 text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Precio de venta (USD/min)</Label>
            <div className="relative mt-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#6b6b6b] pointer-events-none select-none">
                $
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={pricePerMin}
                onChange={(e) =>
                  setPricePerMin(parseFloat(e.target.value) || 0)
                }
                className="h-9 text-sm font-mono pl-5"
              />
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="rounded-lg border border-[#e0e0e0] divide-y divide-[#e0e0e0]">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-[#6b6b6b]">Costo total (COGS)</span>
            <div className="text-right">
              <span className="text-base font-bold text-red-600">
                {fmtUSD(cogs)}
              </span>
              <span className="block text-[11px] text-[#6b6b6b]">
                {fmtUSD(cogs / durMin)}/min
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-[#6b6b6b]">Ingreso</span>
            <div className="text-right">
              <span className="text-base font-bold text-[#0a0a0a]">
                {fmtUSD(revenue)}
              </span>
              <span className="block text-[11px] text-[#6b6b6b]">
                {fmtUSD(pricePerMin)}/min
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-[#fafafa] rounded-b-lg">
            <span className="text-sm font-medium text-[#0a0a0a]">
              Ganancia bruta
            </span>
            <div className="text-right">
              <span
                className={`text-lg font-bold ${gross >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {fmtUSD(gross)}
              </span>
              <span className="block text-[11px] text-[#6b6b6b]">
                {grossPct.toFixed(1)}% de margen
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
