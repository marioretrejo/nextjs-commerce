import { Card, CardContent } from "@/components/ui/card";
import { Calculator, DollarSign, TrendingUp } from "lucide-react";
import { fmtUSD } from "./pricing";

export function SummaryCards({
  breakEven,
  grossPct,
  pricePerMin,
  cogs,
  durMin,
}: {
  breakEven: number;
  grossPct: number;
  pricePerMin: number;
  cogs: number;
  durMin: number;
}) {
  const cards = [
    {
      label: "Precio de equilibrio (50% margen)",
      value: `${fmtUSD(breakEven)}/min`,
      sub: "Mínimo para ser rentable",
      icon: <DollarSign className="h-4 w-4" />,
      color: "text-[#0a0a0a]",
    },
    {
      label: "Margen bruto",
      value: `${grossPct.toFixed(1)}%`,
      sub: `Con precio de ${fmtUSD(pricePerMin)}/min`,
      icon: <TrendingUp className="h-4 w-4" />,
      color:
        grossPct >= 40
          ? "text-green-600"
          : grossPct >= 0
            ? "text-amber-600"
            : "text-red-600",
    },
    {
      label: "Costo por minuto",
      value: fmtUSD(cogs / durMin),
      sub: "Todos los proveedores combinados",
      icon: <Calculator className="h-4 w-4" />,
      color: "text-[#0a0a0a]",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
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
  );
}
