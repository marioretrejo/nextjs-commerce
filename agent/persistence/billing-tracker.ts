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

  // TTS is accumulated across many session.say() calls during a call;
  // we flush into _usage as a single consolidated record in computeAndPersist().
  private _ttsCharsTotal = 0;
  private _ttsSayCount = 0;

  // LLM tokens are estimated once at call-end; accumulated for completeness.
  private _llmTokensTotal = 0;

  constructor(room: string, workspaceId: string, agentId?: string) {
    this._room = room;
    this._workspaceId = workspaceId;
    this._agentId = agentId ?? null;
  }

  trackTelephony(
    durationSeconds: number,
    direction: "inbound" | "outbound",
  ): void {
    this._usage.push({
      provider: "twilio",
      cost_type: "telephony",
      quantity: durationSeconds / 60,
      unit: "minutes",
      metadata: {
        direction,
        estimation_method: "call_duration_seconds",
        confidence: "medium",
        quantity_source: "real",
        duration_seconds: durationSeconds,
        pricing_unit: "usd_per_minute",
      },
    });
  }

  trackLiveKit(durationSeconds: number): void {
    this._usage.push({
      provider: "livekit",
      cost_type: "livekit_media",
      quantity: durationSeconds / 60,
      unit: "minutes",
      metadata: {
        estimation_method: "call_duration_seconds_rounded_to_minutes",
        confidence: "medium",
        quantity_source: "real",
        duration_seconds: durationSeconds,
        pricing_unit: "usd_per_minute",
      },
    });
  }

  trackSTT(durationSeconds: number): void {
    this._usage.push({
      provider: "deepgram",
      cost_type: "stt",
      quantity: durationSeconds / 60,
      unit: "minutes",
      metadata: {
        estimation_method: "call_duration_seconds",
        confidence: "medium",
        quantity_source: "real",
        duration_seconds: durationSeconds,
        pricing_unit: "usd_per_minute",
      },
    });
  }

  // Accumulates TTS characters across all session.say() calls.
  // Call this every time text is sent to TTS (via trackedSay wrapper).
  // A single consolidated cost event is emitted at computeAndPersist time.
  trackTTS(characters: number): void {
    if (characters <= 0) return;
    this._ttsCharsTotal += characters;
    this._ttsSayCount++;
  }

  // Accumulates estimated LLM token counts (estimated from transcript length).
  // A single consolidated cost event is emitted at computeAndPersist time.
  trackLLMTokens(estimatedTokens: number): void {
    if (estimatedTokens <= 0) return;
    this._llmTokensTotal += estimatedTokens;
  }

  async computeAndPersist(
    callId: string | null,
    supabase: SupabaseClient,
  ): Promise<void> {
    // Flush accumulated TTS and LLM token counts into the usage array
    if (this._ttsCharsTotal > 0) {
      this._usage.push({
        provider: "cartesia",
        cost_type: "tts",
        quantity: this._ttsCharsTotal,
        unit: "characters",
        metadata: {
          estimation_method: "tracked_session_say_text_length",
          confidence: "medium",
          quantity_source: "estimated",
          pricing_unit: "usd_per_1k_characters",
          say_count: this._ttsSayCount,
        },
      });
    }
    if (this._llmTokensTotal > 0) {
      this._usage.push({
        provider: "groq",
        cost_type: "llm",
        quantity: this._llmTokensTotal,
        unit: "tokens",
        metadata: {
          estimation_method: "transcript_chars_divided_by_3",
          confidence: "low",
          quantity_source: "estimated",
          pricing_unit: "usd_per_1k_tokens",
        },
      });
    }

    if (this._usage.length === 0) return;

    try {
      const costs = await lookupProviderCosts(supabase);
      const rows: CostEventRow[] = [];
      let pricedCount = 0;
      let unknownCount = 0;
      let totalCostUsd = 0;

      for (const u of this._usage) {
        const priced = this._priceUsage(u, costs);
        if (priced.total_cost_usd === null) {
          unknownCount++;
        } else {
          pricedCount++;
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
          // Merge per-record estimation metadata with any pricing-time metadata
          metadata: { ...u.metadata, ...priced.pricingMeta },
        });
      }

      const { error: insertErr } = await supabase
        .from("call_cost_events")
        .insert(rows);

      if (insertErr) {
        console.warn("[billing-tracker] insert failed:", insertErr.message);
        // Mark the calls row as failed so operators know costs are incomplete
        if (callId) {
          await supabase
            .from("calls")
            .update({ cost_status: "failed" })
            .eq("id", callId);
        }
        return;
      }

      if (callId) {
        const breakdown = buildBreakdown(rows);
        // cost_status classification:
        // not_calculated: nothing could be priced
        // partial:        some priced, some unknown
        // estimated:      all priced (but quantities are estimated, not provider-reported)
        const costStatus =
          pricedCount === 0
            ? "not_calculated"
            : unknownCount > 0
              ? "partial"
              : "estimated";

        await supabase
          .from("calls")
          .update({
            cost_usd: pricedCount > 0 ? round6(totalCostUsd) : 0,
            cost_breakdown: breakdown,
            cost_status: costStatus,
          })
          .eq("id", callId);
      }
    } catch (err) {
      console.warn("[billing-tracker] computeAndPersist error:", String(err));
    }
  }

  // Safety backfill: sets call_id on any cost events written before the calls
  // row existed. In normal flow cost events already have call_id set, but this
  // guard handles edge-cases (e.g. DB contention during upsert).
  async backfillCallId(
    callId: string,
    supabase: SupabaseClient,
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("call_cost_events")
        .update({ call_id: callId })
        .eq("call_room", this._room)
        .eq("workspace_id", this._workspaceId)
        .is("call_id", null);
      if (!error) {
        console.info(
          `[billing-tracker] billing.cost_events_backfilled room=${this._room} call_id=${callId}`,
        );
      }
    } catch (err) {
      console.warn("[billing-tracker] backfillCallId error:", String(err));
    }
  }

  private _priceUsage(
    u: UsageRecord,
    costs: Awaited<ReturnType<typeof lookupProviderCosts>>,
  ): ReturnType<typeof priceTelephonyMinutes> & {
    pricingMeta: Record<string, unknown>;
  } {
    let base: ReturnType<typeof priceTelephonyMinutes>;
    let pricingMeta: Record<string, unknown> = {};

    switch (u.cost_type) {
      case "telephony": {
        const dir = u.metadata["direction"] as "inbound" | "outbound";
        base = priceTelephonyMinutes(u.quantity, dir, costs);
        if (base.unit_cost_usd !== null) {
          pricingMeta = {
            raw_rate_cents:
              costs?.[
                dir === "outbound"
                  ? "twilio_outbound_per_min"
                  : "twilio_inbound_per_min"
              ] ?? null,
            calculation: `${u.quantity.toFixed(4)} min × $${base.unit_cost_usd.toFixed(8)}/min`,
          };
        }
        break;
      }
      case "livekit_media": {
        base = priceLiveKitMinutes(u.quantity, costs);
        if (base.unit_cost_usd !== null) {
          pricingMeta = {
            raw_rate_cents: costs?.livekit_per_min ?? null,
            calculation: `${u.quantity.toFixed(4)} min × $${base.unit_cost_usd.toFixed(8)}/min`,
          };
        }
        break;
      }
      case "stt": {
        base = priceSTTMinutes(u.quantity, costs);
        if (base.unit_cost_usd !== null) {
          pricingMeta = {
            raw_rate_cents: costs?.stt_per_min ?? null,
            calculation: `${u.quantity.toFixed(4)} min × $${base.unit_cost_usd.toFixed(8)}/min`,
          };
        }
        break;
      }
      case "tts": {
        base = priceTTSChars(u.quantity, costs);
        if (base.unit_cost_usd !== null) {
          pricingMeta = {
            raw_rate_cents: costs?.tts_per_1k_chars ?? null,
            calculation: `${u.quantity} chars × $${base.unit_cost_usd.toFixed(10)}/char`,
          };
        }
        break;
      }
      case "llm": {
        base = priceLLMTokens(u.quantity, costs);
        if (base.unit_cost_usd !== null) {
          pricingMeta = {
            raw_rate_cents: costs?.llm_per_1k_tokens ?? null,
            calculation: `${u.quantity} tokens × $${base.unit_cost_usd.toFixed(10)}/token`,
          };
        }
        break;
      }
      default:
        base = {
          unit_cost_usd: null,
          total_cost_usd: null,
          pricing_source: "unknown" as const,
        };
    }

    return { ...base, pricingMeta };
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
