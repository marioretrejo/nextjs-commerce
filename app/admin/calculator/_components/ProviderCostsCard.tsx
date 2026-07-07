import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { COST_FIELDS, type ProviderCosts } from "./pricing";

export function ProviderCostsCard({
  costs,
  onChange,
}: {
  costs: ProviderCosts;
  onChange: (key: keyof ProviderCosts, raw: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Costos de Proveedores</CardTitle>
        <CardDescription>
          Valores en USD — precios oficiales de cada proveedor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TooltipProvider delayDuration={0}>
          {COST_FIELDS.map(({ key, label, unit, hint, how }) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs font-medium text-[#0a0a0a]">
                  {label}
                  <span className="ml-1.5 text-[#6b6b6b] font-normal">
                    ({unit})
                  </span>
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-[#a0a0a0] hover:text-[#0a0a0a] transition-colors"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="max-w-xs leading-relaxed"
                  >
                    <p className="font-medium mb-1">{label}</p>
                    <p className="text-[#6b6b6b]">{how}</p>
                    <p className="mt-1.5 text-[#a0a0a0] italic">{hint}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#6b6b6b] pointer-events-none select-none">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={costs[key]}
                    onChange={(e) => onChange(key, e.target.value)}
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
  );
}
