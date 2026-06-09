/**
 * Pure aggregation logic for analytics — importable by both the API route and tests.
 */

export interface CallRow {
  id: string;
  duration_seconds: number | null;
  cost_usd: number | null;
  cost_breakdown: Record<string, { total_cost_usd?: number }> | null;
  cost_status: string | null;
  business_outcome: string | null;
  technical_status: string | null;
  end_reason: string | null;
}

export interface AnalyticsResult {
  workspace_id: string;
  date_range: { start_date: string | null; end_date: string | null };
  volume: {
    total_calls: number;
    total_minutes: number;
  };
  financial: {
    total_cost_usd: number;
    avg_cost_per_call_usd: number;
    cost_breakdown_totals: Record<string, number>;
  };
  efficiency: {
    outcome_distribution: Record<string, number>;
    billing_rejections: number;
    completion_rate: number;
  };
}

export function computeCallAnalytics(
  calls: CallRow[],
  workspaceId: string,
  startDate: string | null,
  endDate: string | null,
): AnalyticsResult {
  const totalCalls = calls.length;
  const totalSeconds = calls.reduce((s, c) => s + (c.duration_seconds ?? 0), 0);
  const totalCostUsd = calls.reduce((s, c) => s + (c.cost_usd ?? 0), 0);
  const avgCostPerCall = totalCalls > 0 ? totalCostUsd / totalCalls : 0;

  // Aggregate cost_breakdown JSONB components across all calls
  const costBreakdownTotals: Record<string, number> = {};
  for (const c of calls) {
    if (c.cost_breakdown && typeof c.cost_breakdown === "object") {
      for (const [key, val] of Object.entries(c.cost_breakdown)) {
        const amount = val?.total_cost_usd ?? 0;
        costBreakdownTotals[key] = (costBreakdownTotals[key] ?? 0) + amount;
      }
    }
  }

  // Business outcome distribution
  const outcomeDistribution: Record<string, number> = {};
  for (const c of calls) {
    const outcome = c.business_outcome ?? "unknown";
    outcomeDistribution[outcome] = (outcomeDistribution[outcome] ?? 0) + 1;
  }

  // Billing rejections: calls terminated by circuit breaker or insufficient funds
  const billingRejections = calls.filter(
    (c) =>
      c.end_reason === "insufficient_funds" ||
      c.business_outcome === "billing_rejection",
  ).length;

  // Completion rate: calls that reached completed or ended technical status
  const completedCalls = calls.filter(
    (c) => c.technical_status === "completed" || c.technical_status === "ended",
  ).length;
  const completionRate =
    totalCalls > 0
      ? Math.round((completedCalls / totalCalls) * 10_000) / 100
      : 0;

  return {
    workspace_id: workspaceId,
    date_range: { start_date: startDate, end_date: endDate },
    volume: {
      total_calls: totalCalls,
      total_minutes: Math.round((totalSeconds / 60) * 100) / 100,
    },
    financial: {
      total_cost_usd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
      avg_cost_per_call_usd: Math.round(avgCostPerCall * 1_000_000) / 1_000_000,
      cost_breakdown_totals: Object.fromEntries(
        Object.entries(costBreakdownTotals).map(([k, v]) => [
          k,
          Math.round(v * 1_000_000) / 1_000_000,
        ]),
      ),
    },
    efficiency: {
      outcome_distribution: outcomeDistribution,
      billing_rejections: billingRejections,
      completion_rate: completionRate,
    },
  };
}
