import type { SupabaseClient } from "@supabase/supabase-js";
import {
  lookupProviderCosts,
  priceTelephonyMinutes,
  priceLiveKitMinutes,
  priceSTTMinutes,
  priceTTSChars,
  priceLLMTokens,
} from "../../lib/billing/provider-pricing.js";

interface UsageRecord {
  provider: string;
  cost_type: string;
  quantity: number;
  unit: string;
  metadata: Record<string, unknown>;
}

type CostEventRow = Record<string, unknown>;

export class BillingTracker {
  private readonly _room: string;
  private readonly _workspaceId: string;
  private readonly _agentId: string | null;
  private readonly _usage: UsageRecord[] = [];

  constructor(room: string, workspaceId: string, agentId?: string) {
    this._room = room;
    this._workspaceId = workspaceId;
    this._agentId = agentId ?? null;
  }

  trackTelephony(durationSeconds: number, direction: "inbound" | "outbound"): void {
    this._usage.push({
      provider: "twilio",
      cost_type: "telephony",
      quantity: durationSeconds / 60,
      unit: "minutes",
      metadata: { direction, quantity_source: "real", duration_seconds: durationSeconds },
    });
  }

  trackLiveKit(durationSeconds: number): void {
    this._usage.push({
      provider: "livekit",
      cost_type: "livekit_media",
      quantity: durationSeconds / 60,
      unit: "minutes",
      metadata: { quantity_source: "real", duration_seconds: durationSeconds },
    });
  }

  trackSTT(durationSeconds: number): void {
    this._usage.push({
      provider: "deepgram",
      cost_type: "stt",
      quantity: durationSeconds / 60,
      unit: "minutes",
      metadata: { quantity_source: "real", duration_seconds: durationSeconds },
    });
  }

  trackTTS(characters: number): void {
    if (characters <= 0) return;
    this._usage.push({
      provider: "cartesia",
      cost_type: "tts",
      quantity: characters,
      unit: "characters",
      metadata: { quantity_source: "estimated" },
    });
  }

  trackLLMTokens(estimatedTokens: number): void {
    if (estimatedTokens <= 0) return;
    this._usage.push({
      provider: "groq",
      cost_type: "llm",
      quantity: estimatedTokens,
      unit: "tokens",
      metadata: { quantity_source: "estimated" },
    });
  }

  async computeAndPersist(
    callId: string | null,
    supabase: SupabaseClient,
  ): Promise<void> {
    if (this._usage.length === 0) return;
    try {
      const costs = await lookupProviderCosts(supabase);
      const rows: CostEventRow[] = [];
      let totalCostUsd = 0;
      let allPricingKnown = true;

      for (const u of this._usage) {
        const priced = this._priceUsage(u, costs);
        if (priced.total_cost_usd === null) {
          allPricingKnown = false;
        } else {
          totalCostUsd += priced.total_cost_usd;
        }
        rows.push({
          call_id: callId,
          workspace_id: this._workspaceId,
          agent_id: this._agentId,
          call_room: this._room,
          provider: u.provider,
          cost_type: u.cost_type,
          quantity: u.quantity,
          unit: u.unit,
          unit_cost_usd: priced.unit_cost_usd,
          total_cost_usd: priced.total_cost_usd,
          currency: "usd",
          pricing_source: priced.pricing_source,
          metadata: u.metadata,
        });
      }

      const { error: insertErr } = await supabase
        .from("call_cost_events")
        .insert(rows);
      if (insertErr) {
        console.warn("[billing-tracker] insert failed:", insertErr.message);
        return;
      }

      if (callId) {
        const breakdown = buildBreakdown(rows);
        const costStatus = allPricingKnown ? "estimated" : "not_calculated";
        await supabase
          .from("calls")
          .update({
            cost_usd: allPricingKnown ? round6(totalCostUsd) : 0,
            cost_breakdown: breakdown,
            cost_status: costStatus,
          })
          .eq("id", callId);
      }
    } catch (err) {
      console.warn("[billing-tracker] computeAndPersist error:", String(err));
    }
  }

  // Backfill call_id on cost events recorded before the calls row existed
  async backfillCallId(
    callId: string,
    supabase: SupabaseClient,
  ): Promise<void> {
    try {
      await supabase
        .from("call_cost_events")
        .update({ call_id: callId })
        .eq("call_room", this._room)
        .eq("workspace_id", this._workspaceId)
        .is("call_id", null);
    } catch (err) {
      console.warn("[billing-tracker] backfillCallId error:", String(err));
    }
  }

  private _priceUsage(
    u: UsageRecord,
    costs: Awaited<ReturnType<typeof lookupProviderCosts>>,
  ) {
    switch (u.cost_type) {
      case "telephony":
        return priceTelephonyMinutes(
          u.quantity,
          u.metadata["direction"] as "inbound" | "outbound",
          costs,
        );
      case "livekit_media":
        return priceLiveKitMinutes(u.quantity, costs);
      case "stt":
        return priceSTTMinutes(u.quantity, costs);
      case "tts":
        return priceTTSChars(u.quantity, costs);
      case "llm":
        return priceLLMTokens(u.quantity, costs);
      default:
        return {
          unit_cost_usd: null as number | null,
          total_cost_usd: null as number | null,
          pricing_source: "unknown" as const,
        };
    }
  }
}

function buildBreakdown(rows: CostEventRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    out[r["cost_type"] as string] = {
      provider: r["provider"],
      quantity: r["quantity"],
      unit: r["unit"],
      total_cost_usd: r["total_cost_usd"],
      pricing_source: r["pricing_source"],
    };
  }
  return out;
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
