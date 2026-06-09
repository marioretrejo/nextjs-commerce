import type { SupabaseClient } from "@supabase/supabase-js";

// Shape of the provider_costs table row (migration 022)
// All rate fields are stored in CENTS (e.g., 0.85 = $0.0085)
export interface ProviderCostRow {
  twilio_outbound_per_min: number;
  twilio_inbound_per_min: number;
  livekit_per_min: number;
  stt_per_min: number;
  llm_per_1k_tokens: number;
  tts_per_1k_chars: number;
}

export interface PricedUsage {
  unit_cost_usd: number | null;
  total_cost_usd: number | null;
  pricing_source: "configured" | "unknown";
}

export async function lookupProviderCosts(
  supabase: SupabaseClient,
): Promise<ProviderCostRow | null> {
  const { data } = await supabase
    .from("provider_costs")
    .select(
      "twilio_outbound_per_min,twilio_inbound_per_min,livekit_per_min,stt_per_min,llm_per_1k_tokens,tts_per_1k_chars",
    )
    .eq("label", "default")
    .maybeSingle();
  return (data as ProviderCostRow | null) ?? null;
}

export function priceTelephonyMinutes(
  minutes: number,
  direction: "inbound" | "outbound",
  costs: ProviderCostRow | null,
): PricedUsage {
  const cents =
    costs?.[
      direction === "outbound"
        ? "twilio_outbound_per_min"
        : "twilio_inbound_per_min"
    ];
  if (typeof cents !== "number")
    return {
      unit_cost_usd: null,
      total_cost_usd: null,
      pricing_source: "unknown",
    };
  const unitCost = cents / 100;
  return {
    unit_cost_usd: unitCost,
    total_cost_usd: round6(minutes * unitCost),
    pricing_source: "configured",
  };
}

export function priceLiveKitMinutes(
  minutes: number,
  costs: ProviderCostRow | null,
): PricedUsage {
  const cents = costs?.livekit_per_min;
  if (typeof cents !== "number")
    return {
      unit_cost_usd: null,
      total_cost_usd: null,
      pricing_source: "unknown",
    };
  const unitCost = cents / 100;
  return {
    unit_cost_usd: unitCost,
    total_cost_usd: round6(minutes * unitCost),
    pricing_source: "configured",
  };
}

export function priceSTTMinutes(
  minutes: number,
  costs: ProviderCostRow | null,
): PricedUsage {
  const cents = costs?.stt_per_min;
  if (typeof cents !== "number")
    return {
      unit_cost_usd: null,
      total_cost_usd: null,
      pricing_source: "unknown",
    };
  const unitCost = cents / 100;
  return {
    unit_cost_usd: unitCost,
    total_cost_usd: round6(minutes * unitCost),
    pricing_source: "configured",
  };
}

export function priceTTSChars(
  chars: number,
  costs: ProviderCostRow | null,
): PricedUsage {
  const cents = costs?.tts_per_1k_chars;
  if (typeof cents !== "number")
    return {
      unit_cost_usd: null,
      total_cost_usd: null,
      pricing_source: "unknown",
    };
  const unitCost = cents / 100 / 1000; // cents per 1k → USD per char
  return {
    unit_cost_usd: unitCost,
    total_cost_usd: round6(chars * unitCost),
    pricing_source: "configured",
  };
}

export function priceLLMTokens(
  tokens: number,
  costs: ProviderCostRow | null,
): PricedUsage {
  const cents = costs?.llm_per_1k_tokens;
  if (typeof cents !== "number")
    return {
      unit_cost_usd: null,
      total_cost_usd: null,
      pricing_source: "unknown",
    };
  const unitCost = cents / 100 / 1000; // cents per 1k → USD per token
  return {
    unit_cost_usd: unitCost,
    total_cost_usd: round6(tokens * unitCost),
    pricing_source: "configured",
  };
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
