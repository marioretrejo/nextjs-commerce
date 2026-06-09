/**
 * Tests for provider-pricing helpers
 *
 * All functions are pure (accept a pre-loaded ProviderCostRow, no DB calls),
 * so these tests are fast and deterministic.
 *
 * Run with: pnpm tsx agent/tests/provider-pricing.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  priceTelephonyMinutes,
  priceLiveKitMinutes,
  priceSTTMinutes,
  priceTTSChars,
  priceLLMTokens,
} from "../../lib/billing/provider-pricing.js";
import type { ProviderCostRow } from "../../lib/billing/provider-pricing.js";

// Default config matching migration 022 seed values (cents)
const DEFAULT_COSTS: ProviderCostRow = {
  twilio_outbound_per_min: 0.85,
  twilio_inbound_per_min: 0.85,
  livekit_per_min: 0.20,
  stt_per_min: 0.59,
  llm_per_1k_tokens: 0.06,
  tts_per_1k_chars: 0.65,
};

// ── priceTelephonyMinutes ─────────────────────────────────────────────────────

test("priceTelephonyMinutes: outbound 1 minute → $0.0085", () => {
  const r = priceTelephonyMinutes(1, "outbound", DEFAULT_COSTS);
  assert.equal(r.pricing_source, "configured");
  assert.equal(r.unit_cost_usd, 0.0085); // 0.85 cents → $0.0085
  assert.equal(r.total_cost_usd, 0.0085);
});

test("priceTelephonyMinutes: inbound 2.5 minutes → $0.02125", () => {
  const r = priceTelephonyMinutes(2.5, "inbound", DEFAULT_COSTS);
  assert.equal(r.pricing_source, "configured");
  assert.ok(Math.abs((r.total_cost_usd ?? 0) - 0.02125) < 1e-8);
});

test("priceTelephonyMinutes: null costs → pricing_source=unknown, nulls", () => {
  const r = priceTelephonyMinutes(1, "outbound", null);
  assert.equal(r.pricing_source, "unknown");
  assert.equal(r.unit_cost_usd, null);
  assert.equal(r.total_cost_usd, null);
});

// ── priceLiveKitMinutes ───────────────────────────────────────────────────────

test("priceLiveKitMinutes: 1 minute → $0.002", () => {
  const r = priceLiveKitMinutes(1, DEFAULT_COSTS);
  assert.equal(r.pricing_source, "configured");
  assert.equal(r.unit_cost_usd, 0.002); // 0.20 cents → $0.002
  assert.equal(r.total_cost_usd, 0.002);
});

test("priceLiveKitMinutes: null costs → unknown", () => {
  const r = priceLiveKitMinutes(1, null);
  assert.equal(r.pricing_source, "unknown");
  assert.equal(r.total_cost_usd, null);
});

// ── priceSTTMinutes ───────────────────────────────────────────────────────────

test("priceSTTMinutes: 1 minute → $0.0059", () => {
  const r = priceSTTMinutes(1, DEFAULT_COSTS);
  assert.equal(r.pricing_source, "configured");
  assert.equal(r.unit_cost_usd, 0.0059);
  assert.equal(r.total_cost_usd, 0.0059);
});

// ── priceTTSChars ─────────────────────────────────────────────────────────────

test("priceTTSChars: 1000 chars → $0.0065", () => {
  // 0.65 cents per 1000 chars = $0.0065 per 1000 chars = $0.0000065 per char
  const r = priceTTSChars(1000, DEFAULT_COSTS);
  assert.equal(r.pricing_source, "configured");
  assert.ok(Math.abs((r.total_cost_usd ?? 0) - 0.0065) < 1e-8);
});

test("priceTTSChars: 500 chars is half of 1000 chars cost", () => {
  const full = priceTTSChars(1000, DEFAULT_COSTS);
  const half = priceTTSChars(500, DEFAULT_COSTS);
  assert.ok(
    Math.abs((full.total_cost_usd ?? 0) / 2 - (half.total_cost_usd ?? 0)) <
      1e-8,
  );
});

test("priceTTSChars: null costs → unknown", () => {
  const r = priceTTSChars(1000, null);
  assert.equal(r.pricing_source, "unknown");
  assert.equal(r.unit_cost_usd, null);
  assert.equal(r.total_cost_usd, null);
});

// ── priceLLMTokens ────────────────────────────────────────────────────────────

test("priceLLMTokens: 1000 tokens → $0.0006", () => {
  // 0.06 cents per 1000 tokens = $0.0006 per 1000 tokens
  const r = priceLLMTokens(1000, DEFAULT_COSTS);
  assert.equal(r.pricing_source, "configured");
  assert.ok(Math.abs((r.total_cost_usd ?? 0) - 0.0006) < 1e-9);
});

test("priceLLMTokens: null costs → unknown", () => {
  const r = priceLLMTokens(1000, null);
  assert.equal(r.pricing_source, "unknown");
  assert.equal(r.total_cost_usd, null);
});

console.log("✓ provider-pricing tests complete");
