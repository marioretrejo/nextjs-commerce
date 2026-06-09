import type { SupabaseClient } from "@supabase/supabase-js";
import {
  lookupProviderCosts,
  priceTelephonyMinutes,
  priceLiveKitMinutes,
  priceSTTMinutes,
  priceTTSChars,
  priceLLMTokens,
} from "../../lib/billing/provider-pricing.js";
import type { ProviderCostRow } from "../../lib/billing/provider-pricing.js";

interface UsageRecord {
  provider: string;
  cost_type: string;
  quantity: number;
  unit: string;
  metadata: Record<string, unknown>;
}

type CostEventRow = Record<string, unknown>;

// Pending manual-say entry: each trackManualSay() call increments count by 1.
// trackPipelineTTS() matching the same key within the dedupe window consumes
// one count and routes those chars to the manual bucket (not pipeline).
interface PendingEntry {
  count: number;
  chars: number;
  ts: number;
}

const DEDUPE_WINDOW_MS = 5_000;

export class BillingTracker {
  private readonly _room: string;
  private readonly _workspaceId: string;
  private readonly _agentId: string | null;
  private readonly _usage: UsageRecord[] = [];

  // TTS provider name — updated at session construction if a fallback was used.
  private _ttsProvider = "cartesia";

  // TTS: two separate source buckets flushed into a single cost event at call-end.
  private _manualSayChars = 0; // from trackedSay() / explicit session.say() injections
  private _manualSayCount = 0;
  private _pipelineChars = 0; // from ConversationItemAdded (LLM-generated responses)
  private _pipelineCount = 0;

  // Dedup registry: maps a short key to pending manual-say units.
  // Consumed by trackPipelineTTS() when ConversationItemAdded fires for the same text.
  private _pendingManual = new Map<string, PendingEntry>();

  // LLM tokens are estimated once at call-end; accumulated for completeness.
  private _llmTokensTotal = 0;

  constructor(room: string, workspaceId: string, agentId?: string) {
    this._room = room;
    this._workspaceId = workspaceId;
    this._agentId = agentId ?? null;
  }

  // Called right after TTS provider construction to record which provider is active.
  setTTSProvider(provider: string): void {
    this._ttsProvider = provider;
  }

  // Pure, synchronous estimate of accumulated call cost so far.
  // Used by the budget circuit breaker to decide whether to terminate the call.
  // Returns 0 when costs are not configured (pricing_source=unknown scenarios).
  getEstimatedCurrentCostUSD(
    elapsedSeconds: number,
    costs: ProviderCostRow | null,
  ): number {
    if (!costs) return 0;
    const elapsedMin = elapsedSeconds / 60;
    // Use the higher of inbound/outbound telephony rate as a conservative estimate
    const telephonyCents =
      elapsedMin *
      Math.max(
        costs.twilio_inbound_per_min ?? 0,
        costs.twilio_outbound_per_min ?? 0,
      );
    const livekitCents = elapsedMin * (costs.livekit_per_min ?? 0);
    const sttCents = elapsedMin * (costs.stt_per_min ?? 0);
    // Include chars that are in _pendingManual (trackManualSay registered, but
    // ConversationItemAdded hasn't fired yet). They will be billed regardless.
    const pendingChars = Array.from(this._pendingManual.values()).reduce(
      (sum, p) => sum + p.chars * p.count,
      0,
    );
    const ttsChars = this._manualSayChars + this._pipelineChars + pendingChars;
    const ttsCents = (ttsChars / 1_000) * (costs.tts_per_1k_chars ?? 0);
    const llmCents =
      (this._llmTokensTotal / 1_000) * (costs.llm_per_1k_tokens ?? 0);
    return (
      (telephonyCents + livekitCents + sttCents + ttsCents + llmCents) / 100
    );
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

  // Called by trackedSay() BEFORE calling session.say(text).
  // Registers the text as a pending manual injection so that when
  // ConversationItemAdded fires for the same text, it is attributed to
  // the manual_session_say source bucket rather than the pipeline bucket.
  trackManualSay(text: string): void {
    const chars = text.length;
    if (chars <= 0) return;
    const key = this._dedupeKey(text);
    const existing = this._pendingManual.get(key);
    if (existing) {
      existing.count++;
      existing.ts = Date.now();
    } else {
      this._pendingManual.set(key, { count: 1, chars, ts: Date.now() });
    }
  }

  // Called from ConversationItemAdded for role=assistant items.
  // Deduplicates against pending manual entries; if a match is found within
  // DEDUPE_WINDOW_MS the chars are routed to _manualSayChars (not double-counted).
  // Non-matching items are LLM pipeline responses → _pipelineChars.
  trackPipelineTTS(text: string): void {
    const chars = text.length;
    if (chars <= 0) return;
    const key = this._dedupeKey(text);
    const pending = this._pendingManual.get(key);
    if (
      pending &&
      pending.count > 0 &&
      Date.now() - pending.ts < DEDUPE_WINDOW_MS
    ) {
      pending.count--;
      if (pending.count === 0) this._pendingManual.delete(key);
      this._manualSayChars += chars;
      this._manualSayCount++;
    } else {
      this._pipelineChars += chars;
      this._pipelineCount++;
    }
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
    // Flush any pending manual entries that ConversationItemAdded never consumed
    // (e.g., session.say() calls issued before the session conversation context
    // started, or future SDK versions that don't emit ConversationItemAdded for
    // injected speech). Count them as manual_session_say so no chars are lost.
    for (const [, p] of this._pendingManual) {
      if (p.count > 0) {
        this._manualSayChars += p.chars * p.count;
        this._manualSayCount += p.count;
      }
    }
    this._pendingManual.clear();

    const totalTtsChars = this._manualSayChars + this._pipelineChars;

    if (totalTtsChars > 0) {
      const pipelineVisibility =
        this._pipelineCount > 0
          ? "captured"
          : this._manualSayCount > 0
            ? "manual_only"
            : "none";

      this._usage.push({
        provider: this._ttsProvider,
        cost_type: "tts",
        quantity: totalTtsChars,
        unit: "characters",
        metadata: {
          estimation_method: "conversation_item_added_with_manual_say_dedup",
          confidence: "medium",
          quantity_source: "estimated",
          pricing_unit: "usd_per_1k_characters",
          tts_pipeline_visibility: pipelineVisibility,
          sources: {
            manual_session_say: {
              characters: this._manualSayChars,
              say_count: this._manualSayCount,
            },
            agent_pipeline_tts: {
              characters: this._pipelineChars,
              message_count: this._pipelineCount,
            },
          },
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

  // Short dedupe key based on character count + first 32 normalized chars.
  // Avoids storing full text in memory while being discriminating enough for
  // the short phrases injected via session.say() (greetings, fillers, farewells).
  private _dedupeKey(text: string): string {
    return `${text.length}:${text.slice(0, 32).toLowerCase().replace(/\s+/g, " ").trim()}`;
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
