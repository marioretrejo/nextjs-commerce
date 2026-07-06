import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { HealthSummaryRow } from "./types";
import { StatusBadge, CircuitBadge } from "./badges";

export function ProviderCard({ row }: { row: HealthSummaryRow }) {
  const borderColor =
    row.status === "down"
      ? "border-red-300"
      : row.status === "degraded"
        ? "border-yellow-300"
        : "border-border";

  return (
    <Card className={`border ${borderColor}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm capitalize">
                {row.provider.replace(/_/g, " ")}
              </span>
              <Badge variant="outline" className="text-xs font-normal">
                {row.provider_type}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <StatusBadge status={row.status} />
              <CircuitBadge state={row.circuit_state} />
            </div>
          </div>
          <div className="text-right shrink-0 text-xs text-muted-foreground">
            <div>n={row.sample_size}</div>
            {row.checked_at && (
              <div className="mt-0.5">
                {formatDistanceToNow(new Date(row.checked_at), {
                  addSuffix: true,
                })}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
          {row.error_rate !== null && (
            <div>
              Error rate:{" "}
              <span
                className={
                  row.error_rate >= 0.4
                    ? "text-red-600 font-medium"
                    : row.error_rate >= 0.1
                      ? "text-yellow-600 font-medium"
                      : "text-foreground"
                }
              >
                {(row.error_rate * 100).toFixed(1)}%
              </span>
            </div>
          )}
          {row.latency_ms !== null && (
            <div>
              P95 latency:{" "}
              <span
                className={
                  row.latency_ms >= 5000
                    ? "text-red-600 font-medium"
                    : row.latency_ms >= 2000
                      ? "text-yellow-600 font-medium"
                      : "text-foreground"
                }
              >
                {row.latency_ms}ms
              </span>
            </div>
          )}
          {row.fallback_count > 0 && (
            <div>
              Fallbacks:{" "}
              <span className="text-yellow-600 font-medium">
                {row.fallback_count}
                {row.fallback_provider ? ` → ${row.fallback_provider}` : ""}
              </span>
            </div>
          )}
        </div>

        {row.last_error_code && (
          <div className="mt-2 px-2 py-1 rounded bg-red-50 border border-red-100 text-xs text-red-700 font-mono truncate">
            {row.last_error_code}
            {row.last_error_message ? `: ${row.last_error_message}` : ""}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
