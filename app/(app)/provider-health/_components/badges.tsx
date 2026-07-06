import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Zap,
} from "lucide-react";
import type { HealthSummaryRow, AlertIncident } from "./types";

export function StatusBadge({
  status,
}: {
  status: HealthSummaryRow["status"];
}) {
  const configs = {
    healthy: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Healthy",
      className: "bg-green-100 text-green-800 border-green-200",
    },
    degraded: {
      icon: <AlertTriangle className="h-3 w-3" />,
      label: "Degraded",
      className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    },
    down: {
      icon: <XCircle className="h-3 w-3" />,
      label: "Down",
      className: "bg-red-100 text-red-800 border-red-200",
    },
    unknown: {
      icon: <HelpCircle className="h-3 w-3" />,
      label: "Unknown",
      className: "bg-gray-100 text-gray-600 border-gray-200",
    },
  };
  const c = configs[status] ?? configs.unknown;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.className}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

export function CircuitBadge({
  state,
}: {
  state: HealthSummaryRow["circuit_state"];
}) {
  const configs = {
    closed: { label: "Closed", className: "bg-green-50 text-green-700" },
    half_open: {
      label: "Half-Open",
      className: "bg-yellow-50 text-yellow-700",
    },
    open: { label: "Open", className: "bg-red-50 text-red-700" },
    disabled: { label: "Disabled", className: "bg-gray-50 text-gray-500" },
    unknown: { label: "Unknown", className: "bg-gray-50 text-gray-500" },
  };
  const c = configs[state] ?? configs.unknown;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono ${c.className}`}
    >
      <Zap className="h-2.5 w-2.5" />
      {c.label}
    </span>
  );
}

export function SeverityBadge({
  severity,
}: {
  severity: AlertIncident["severity"];
}) {
  const cfg = {
    critical: "bg-red-100 text-red-800 border-red-200",
    warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    info: "bg-blue-100 text-blue-700 border-blue-200",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border uppercase ${cfg[severity]}`}
    >
      {severity}
    </span>
  );
}
