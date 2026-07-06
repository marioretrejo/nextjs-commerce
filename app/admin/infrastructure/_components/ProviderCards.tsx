"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { HealthData } from "./types";
import { StatusBadge, CircuitBadge } from "./badges";
import { providerLabel, timeAgo } from "./helpers";

export function ProviderCards({
  data,
  windowMinutes,
}: {
  data: HealthData;
  windowMinutes: number;
}) {
  return (
    <>
      {data.summary.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-[#6b6b6b] text-sm">
            No health data in the last {windowMinutes} minutes. Run the
            provider-health cron or wait for calls to generate events.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {data.summary.map((p) => (
            <Card
              key={p.provider}
              className={
                p.status === "down"
                  ? "border-red-200 bg-red-50/30"
                  : p.status === "degraded"
                    ? "border-yellow-200 bg-yellow-50/30"
                    : ""
              }
            >
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start gap-4 justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <p className="font-medium text-[#0a0a0a] text-sm">
                        {providerLabel(p.provider)}
                      </p>
                      <span className="text-xs text-[#6b6b6b] font-mono bg-[#f5f5f5] rounded px-1.5 py-0.5">
                        {p.provider_type}
                      </span>
                      <StatusBadge status={p.status} />
                      <CircuitBadge state={p.circuit_state} />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                      <div>
                        <p className="text-xs text-[#6b6b6b] mb-0.5">
                          p95 Latency
                        </p>
                        <p
                          className={`font-medium text-sm ${
                            (p.latency_ms ?? 0) >= 5000
                              ? "text-red-600"
                              : (p.latency_ms ?? 0) >= 2000
                                ? "text-yellow-600"
                                : "text-[#0a0a0a]"
                          }`}
                        >
                          {p.latency_ms != null ? `${p.latency_ms} ms` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6b6b6b] mb-0.5">
                          Error rate
                        </p>
                        <p
                          className={`font-medium text-sm ${
                            (p.error_rate ?? 0) >= 0.4
                              ? "text-red-600"
                              : (p.error_rate ?? 0) >= 0.1
                                ? "text-yellow-600"
                                : "text-[#0a0a0a]"
                          }`}
                        >
                          {p.error_rate != null
                            ? `${(p.error_rate * 100).toFixed(1)}%`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6b6b6b] mb-0.5">
                          Sample size
                        </p>
                        <p className="font-medium text-sm">{p.sample_size}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6b6b6b] mb-0.5">
                          Fallbacks
                        </p>
                        <p
                          className={`font-medium text-sm ${p.fallback_count > 0 ? "text-yellow-600" : "text-[#0a0a0a]"}`}
                        >
                          {p.fallback_count > 0
                            ? `${p.fallback_count} → ${p.fallback_provider ?? "?"}`
                            : "0"}
                        </p>
                      </div>
                    </div>

                    {p.last_error_message && (
                      <p className="text-xs text-[#6b6b6b] mt-2 font-mono bg-[#f5f5f5] rounded px-2 py-1 truncate">
                        {p.last_error_code && (
                          <span className="text-red-600 mr-1">
                            [{p.last_error_code}]
                          </span>
                        )}
                        {p.last_error_message}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-[#6b6b6b]">Last check</p>
                    <p className="text-xs font-mono mt-0.5">
                      {timeAgo(p.checked_at)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
