import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProviderStatus, CircuitState } from "./types";

export function StatusBadge({ status }: { status: ProviderStatus }) {
  if (status === "healthy")
    return (
      <Badge className="bg-green-600 text-white border-transparent text-xs flex items-center gap-1 w-fit">
        <CheckCircle className="w-3 h-3" /> Healthy
      </Badge>
    );
  if (status === "degraded")
    return (
      <Badge className="bg-yellow-500 text-white border-transparent text-xs flex items-center gap-1 w-fit">
        <AlertCircle className="w-3 h-3" /> Degraded
      </Badge>
    );
  if (status === "down")
    return (
      <Badge className="bg-red-600 text-white border-transparent text-xs flex items-center gap-1 w-fit">
        <XCircle className="w-3 h-3" /> Down
      </Badge>
    );
  return (
    <Badge className="border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs">
      Unknown
    </Badge>
  );
}

export function CircuitBadge({ state }: { state: CircuitState }) {
  const cls = {
    closed: "bg-[#f5f5f5] text-[#0a0a0a] border-[#e0e0e0]",
    half_open: "bg-yellow-50 text-yellow-700 border-yellow-200",
    open: "bg-red-50 text-red-700 border-red-200",
    disabled: "bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]",
    unknown: "bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]",
  }[state];
  const label = state === "half_open" ? "half-open" : state;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-mono ${cls}`}
    >
      {label}
    </span>
  );
}
