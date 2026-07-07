import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { TOKENS_PER_MIN, CHARS_PER_MIN, fmtUSD } from "./pricing";

interface BreakdownRow {
  nombre: string;
  costo: number;
  tasa: string;
}

export function BreakdownTable({
  breakdown,
  cogs,
  durMin,
}: {
  breakdown: BreakdownRow[];
  cogs: number;
  durMin: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Desglose de Costos — por llamada
        </CardTitle>
        <CardDescription>
          Para una llamada de {durMin} min · estimado {TOKENS_PER_MIN} tok/min ·{" "}
          {CHARS_PER_MIN} chars/min
        </CardDescription>
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
            {breakdown.map((row) => (
              <tr key={row.nombre} className="hover:bg-[#f9f9f9]">
                <td className="px-5 py-2.5 text-[#0a0a0a] font-medium">
                  {row.nombre}
                </td>
                <td className="px-5 py-2.5 text-right text-[#6b6b6b] font-mono text-xs">
                  {row.tasa}
                </td>
                <td className="px-5 py-2.5 text-right font-mono font-medium">
                  {fmtUSD(row.costo)}
                </td>
                <td className="px-5 py-2.5 text-right text-[#6b6b6b]">
                  {cogs > 0 ? `${((row.costo / cogs) * 100).toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-[#0a0a0a] bg-[#f5f5f5] font-semibold">
              <td className="px-5 py-2.5">Total</td>
              <td className="px-5 py-2.5 text-right text-[#6b6b6b] font-mono text-xs">
                {fmtUSD(cogs / durMin)}/min
              </td>
              <td className="px-5 py-2.5 text-right font-mono">
                {fmtUSD(cogs)}
              </td>
              <td className="px-5 py-2.5 text-right">100%</td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
