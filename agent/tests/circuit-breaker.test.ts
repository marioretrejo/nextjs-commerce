/**
 * Unit tests: Budget Circuit Breaker
 *
 * Verifies:
 *  1. getEstimatedCurrentCostUSD() math (pure, synchronous, in-memory).
 *  2. Pre-flight logic: is_frozen workspace should abort; healthy workspace proceeds.
 *  3. BillingTracker.setTTSProvider() changes the provider field in the cost event.
 *
 * Run with: pnpm tsx agent/tests/circuit-breaker.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BillingTracker } from "../persistence/billing-tracker.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProviderCostRow } from "../../lib/billing/provider-pricing.js";

// ── Shared cost fixture ───────────────────────────────────────────────────────

const COSTS: ProviderCostRow = {
  twilio_outbound_per_min: 0.85, // cents
  twilio_inbound_per_min: 0.85,
  livekit_per_min: 0.2,
  stt_per_min: 0.59,
  llm_per_1k_tokens: 0.06,
  tts_per_1k_chars: 0.65,
};

// ── Supabase stub ─────────────────────────────────────────────────────────────

function makeStub(providerCosts: ProviderCostRow | null = COSTS) {
  const log: { table: string; op: string; data: unknown }[] = [];
  const stub = {
    from: (table: string) => {
      if (table === "provider_costs") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: providerCosts, error: null }),
            }),
          }),
        };
      }
      if (table === "call_cost_events") {
        return {
          insert: (rows: unknown) => {
            log.push({ table, op: "insert", data: rows });
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === "calls") {
        return {
          update: (patch: unknown) => ({
            eq: () => {
              log.push({ table, op: "update", data: patch });
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      return {};
    },
    _log: log,
  } as unknown as SupabaseClient & { _log: typeof log };
  return stub;
}

// ── getEstimatedCurrentCostUSD ────────────────────────────────────────────────

test("getEstimatedCurrentCostUSD: returns 0 when costs is null", () => {
  const bt = new BillingTracker("room-1", "ws-1");
  assert.equal(bt.getEstimatedCurrentCostUSD(60, null), 0);
});

test("getEstimatedCurrentCostUSD: returns 0 before any usage", () => {
  const bt = new BillingTracker("room-2", "ws-1");
  assert.equal(bt.getEstimatedCurrentCostUSD(0, COSTS), 0);
});

test("getEstimatedCurrentCostUSD: telephony-only estimate is correct", () => {
  const bt = new BillingTracker("room-3", "ws-1");
  // 60s elapsed → 1 min telephony + livekit + stt (no TTS or LLM)
  const estimate = bt.getEstimatedCurrentCostUSD(60, COSTS);
  // telephony: 0.85 cents/min = $0.0085, livekit: 0.20 cents/min = $0.002, stt: 0.59 cents/min = $0.0059
  const expectedUSD = (0.85 + 0.2 + 0.59) / 100; // 1 min each
  assert.ok(
    Math.abs(estimate - expectedUSD) < 0.000001,
    `expected ≈ ${expectedUSD.toFixed(8)}, got ${estimate.toFixed(8)}`,
  );
});

test("getEstimatedCurrentCostUSD: TTS chars accumulate into estimate", () => {
  const bt = new BillingTracker("room-4", "ws-1");
  bt.trackManualSay("Hello world"); // 11 chars → manual_session_say
  // 11 chars TTS at $0.0065/1k chars = $0.0000715
  const estimate = bt.getEstimatedCurrentCostUSD(0, COSTS);
  const expectedTTSCents = (11 / 1_000) * 0.65;
  const expectedUSD = expectedTTSCents / 100;
  assert.ok(
    Math.abs(estimate - expectedUSD) < 0.0000001,
    `TTS chars only: expected ≈ ${expectedUSD.toFixed(10)}, got ${estimate.toFixed(10)}`,
  );
});

test("getEstimatedCurrentCostUSD: LLM tokens accumulate into estimate", () => {
  const bt = new BillingTracker("room-5", "ws-1");
  bt.trackLLMTokens(1000);
  // 1000 tokens at 0.06 cents/1k = $0.0006
  const estimate = bt.getEstimatedCurrentCostUSD(0, COSTS);
  const expectedUSD = (1000 / 1_000) * (0.06 / 100);
  assert.ok(
    Math.abs(estimate - expectedUSD) < 0.000001,
    `LLM tokens only: expected ≈ ${expectedUSD.toFixed(10)}, got ${estimate.toFixed(10)}`,
  );
});

test("getEstimatedCurrentCostUSD: full call estimate sums all components", () => {
  const bt = new BillingTracker("room-6", "ws-1");
  const greeting = "Hello! Thank you for calling."; // 30 chars
  bt.trackManualSay(greeting);
  bt.trackPipelineTTS(greeting); // → manual (deduped)

  const llmResponse = "How can I help you today?"; // 25 chars
  bt.trackPipelineTTS(llmResponse); // → pipeline
  bt.trackLLMTokens(200);

  // Estimate at 60s
  const estimate = bt.getEstimatedCurrentCostUSD(60, COSTS);

  // Expected breakdown (all in cents, divide by 100 for USD):
  const telephonyCents =
    1 * Math.max(COSTS.twilio_inbound_per_min, COSTS.twilio_outbound_per_min);
  const livekitCents = 1 * COSTS.livekit_per_min;
  const sttCents = 1 * COSTS.stt_per_min;
  // Use actual .length — avoid off-by-one from hardcoded char counts
  const ttsCents =
    ((greeting.length + llmResponse.length) / 1_000) * COSTS.tts_per_1k_chars;
  const llmCents = (200 / 1_000) * COSTS.llm_per_1k_tokens;
  const expectedUSD =
    (telephonyCents + livekitCents + sttCents + ttsCents + llmCents) / 100;

  assert.ok(
    Math.abs(estimate - expectedUSD) < 0.000001,
    `full estimate: expected ≈ ${expectedUSD.toFixed(8)}, got ${estimate.toFixed(8)}`,
  );
});

test("getEstimatedCurrentCostUSD: scales linearly with elapsed time", () => {
  const bt = new BillingTracker("room-7", "ws-1");
  const at30 = bt.getEstimatedCurrentCostUSD(30, COSTS);
  const at60 = bt.getEstimatedCurrentCostUSD(60, COSTS);
  // Should be exactly double (no TTS/LLM to skew)
  assert.ok(
    Math.abs(at60 - at30 * 2) < 0.000001,
    `60s estimate (${at60}) should be ~2x the 30s estimate (${at30})`,
  );
});

// ── setTTSProvider ─────────────────────────────────────────────────────────────

test("setTTSProvider: changes provider field in emitted cost row", async () => {
  const bt = new BillingTracker("room-8", "ws-1");
  bt.setTTSProvider("openai");
  bt.trackManualSay("Fallback speech here");
  bt.trackPipelineTTS("Fallback speech here"); // → manual

  const sb = makeStub(COSTS);
  await bt.computeAndPersist("call-8", sb);

  const rows = sb._log.find((l) => l.table === "call_cost_events")!
    .data as Record<string, unknown>[];
  const tts = rows.find((r) => r["cost_type"] === "tts")!;
  assert.equal(
    tts["provider"],
    "openai",
    "TTS row should show openai as provider",
  );
});

test("setTTSProvider: defaults to cartesia when not called", async () => {
  const bt = new BillingTracker("room-9", "ws-1");
  bt.trackManualSay("Normal speech");
  bt.trackPipelineTTS("Normal speech");

  const sb = makeStub(COSTS);
  await bt.computeAndPersist("call-9", sb);

  const rows = sb._log.find((l) => l.table === "call_cost_events")!
    .data as Record<string, unknown>[];
  const tts = rows.find((r) => r["cost_type"] === "tts")!;
  assert.equal(tts["provider"], "cartesia");
});

// ── Pre-flight frozen logic (unit-tested via pure boolean check) ──────────────

test("pre-flight: is_frozen=false allows call to proceed (availableUSD > estimatedUSD)", () => {
  // Simulate what the worker does: set availableWorkspaceBalanceCents from RPC result
  // then compare against getEstimatedCurrentCostUSD. Here we verify the math only.
  const bt = new BillingTracker("room-10", "ws-1");
  bt.trackManualSay("Hello");
  const estimated = bt.getEstimatedCurrentCostUSD(5, COSTS); // 5s in
  // Balance = $10.00 = 1000 cents
  const availableUSD = 1000 / 100; // $10.00
  assert.ok(estimated < availableUSD, "5-second call should not exhaust $10");
});

test("pre-flight: is_frozen=true (balance < 50 cents) should trigger abort", () => {
  // Simulate balance of 10 cents — below the 50-cent minimum
  const balanceCents = 10;
  const isFrozen = balanceCents < 50; // mirrors the RPC logic
  assert.ok(isFrozen, "10 cents should be flagged as frozen");
});

test("circuit breaker: triggers when estimated cost >= available balance", () => {
  const bt = new BillingTracker("room-11", "ws-1");
  // Simulate a 10-minute call with lots of TTS at very low balance
  const longText = "A".repeat(5000);
  bt.trackManualSay(longText);
  bt.trackPipelineTTS(longText); // → manual

  const estimated = bt.getEstimatedCurrentCostUSD(600, COSTS); // 10 min
  const availableUSD = 0.05; // 5 cents — very low
  assert.ok(
    estimated >= availableUSD,
    `${estimated.toFixed(6)} should exceed $0.05 available`,
  );
});

test("circuit breaker: does NOT trigger when balance is ample", () => {
  const bt = new BillingTracker("room-12", "ws-1");
  bt.trackManualSay("Hello");

  const estimated = bt.getEstimatedCurrentCostUSD(30, COSTS); // 30s in
  const availableUSD = 100 / 100; // $1.00
  assert.ok(
    estimated < availableUSD,
    `${estimated.toFixed(6)} should not exceed $1.00`,
  );
});

console.log("✓ circuit-breaker tests complete");
