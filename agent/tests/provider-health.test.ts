/**
 * Unit tests for lib/observability/provider-health.ts
 *
 * Run with: pnpm tsx agent/tests/provider-health.test.ts
 *
 * Covers:
 *  1. sanitizeProviderError — strips secrets, truncates
 *  2. classifyProviderStatus — healthy / degraded / down / unknown
 *  3. Circuit state inference
 *  4. MIN_SAMPLE_FOR_CLASSIFICATION guard
 *  5. Latency percentile computation
 *  6. Fallback events
 *  7. Webhook events
 *  8. Post-call job events
 *  9. Empty event set → empty result
 * 10. Mixed provider events
 * 11. Billing circuit_breaker_triggered
 * 12. HEALTH_THRESHOLDS invariants
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeProviderError,
  classifyProviderStatus,
  computeProviderHealthFromEvents,
  HEALTH_THRESHOLDS,
  type ProviderMetrics,
} from "../../lib/observability/provider-health.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(
  event_type: string,
  payload: Record<string, unknown> = {},
): {
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
} {
  return { event_type, payload, created_at: new Date().toISOString() };
}

function makeMetrics(
  overrides: Partial<ProviderMetrics> = {},
): ProviderMetrics {
  return {
    provider: "groq",
    providerType: "llm",
    sampleSize: 10,
    successCount: 9,
    errorCount: 1,
    fallbackCount: 0,
    latencyValues: [],
    circuitBreakerTriggered: false,
    ...overrides,
  };
}

// ── 1. sanitizeProviderError ──────────────────────────────────────────────────

test("sanitizeProviderError strips Bearer token", () => {
  const result = sanitizeProviderError(
    "Request failed: Bearer eyJhbGciOiJIUzI1NiJ9.abc",
  );
  assert.ok(!result.includes("eyJ"), "Should redact token");
  assert.ok(result.includes("[REDACTED]"), "Should insert placeholder");
});

test("sanitizeProviderError strips api_key pattern", () => {
  const result = sanitizeProviderError(
    "api_key=sk-abc123def456ghi789jkl012mno345pqrst",
  );
  assert.ok(!result.includes("sk-abc123"), "Should redact key");
  assert.ok(result.includes("[REDACTED]"), "Should insert placeholder");
});

test("sanitizeProviderError truncates to 200 chars max", () => {
  const long = "A".repeat(500);
  const result = sanitizeProviderError(long);
  assert.ok(result.length <= 200, `Should be ≤200 chars, got ${result.length}`);
});

test("sanitizeProviderError handles Error objects", () => {
  const err = new Error("connection timeout");
  const result = sanitizeProviderError(err);
  assert.equal(result, "connection timeout");
});

test("sanitizeProviderError handles null and undefined", () => {
  assert.doesNotThrow(() => sanitizeProviderError(null));
  assert.doesNotThrow(() => sanitizeProviderError(undefined));
  assert.equal(sanitizeProviderError(null), "");
  assert.equal(sanitizeProviderError(undefined), "");
});

// ── 2. classifyProviderStatus — MIN_SAMPLE guard ──────────────────────────────

test("classifyProviderStatus returns unknown when sample < MIN_SAMPLE", () => {
  const m = makeMetrics({ sampleSize: 2, successCount: 2, errorCount: 0 });
  const result = classifyProviderStatus(m);
  assert.equal(result.status, "unknown");
  assert.equal(result.circuitState, "unknown");
});

test("classifyProviderStatus classifies at MIN_SAMPLE", () => {
  const n = HEALTH_THRESHOLDS.MIN_SAMPLE_FOR_CLASSIFICATION;
  const m = makeMetrics({ sampleSize: n, successCount: n, errorCount: 0 });
  const result = classifyProviderStatus(m);
  assert.equal(result.status, "healthy");
});

// ── 3. Status tiers ───────────────────────────────────────────────────────────

test("classifyProviderStatus healthy: 0% error rate", () => {
  const m = makeMetrics({ sampleSize: 10, successCount: 10, errorCount: 0 });
  const result = classifyProviderStatus(m);
  assert.equal(result.status, "healthy");
  assert.equal(result.circuitState, "closed");
});

test("classifyProviderStatus degraded: error rate 20%", () => {
  const m = makeMetrics({ sampleSize: 10, successCount: 8, errorCount: 2 });
  const result = classifyProviderStatus(m);
  assert.equal(result.status, "degraded");
  assert.ok(
    Math.abs(result.errorRate - 0.2) < 0.001,
    "errorRate should be ~0.2",
  );
});

test("classifyProviderStatus down: error rate >= 40%", () => {
  const m = makeMetrics({ sampleSize: 10, successCount: 5, errorCount: 5 });
  assert.equal(classifyProviderStatus(m).status, "down");
});

test("classifyProviderStatus down: p95 latency >= LATENCY_MS_DOWN", () => {
  const m = makeMetrics({
    sampleSize: 10,
    successCount: 10,
    errorCount: 0,
    latencyValues: Array(10).fill(6000),
  });
  assert.equal(classifyProviderStatus(m).status, "down");
});

test("classifyProviderStatus degraded: p95 latency in degraded range", () => {
  const m = makeMetrics({
    sampleSize: 10,
    successCount: 10,
    errorCount: 0,
    latencyValues: Array(10).fill(3000),
  });
  assert.equal(classifyProviderStatus(m).status, "degraded");
});

test("classifyProviderStatus degraded: fallback_count >= FALLBACK_COUNT_DEGRADED", () => {
  const m = makeMetrics({
    sampleSize: 10,
    successCount: 10,
    errorCount: 0,
    fallbackCount: 1,
  });
  assert.equal(classifyProviderStatus(m).status, "degraded");
});

// ── 4. Circuit state inference ────────────────────────────────────────────────

test("circuitState closed when healthy", () => {
  const m = makeMetrics({ sampleSize: 10, successCount: 10, errorCount: 0 });
  assert.equal(classifyProviderStatus(m).circuitState, "closed");
});

test("circuitState half_open when degraded (10–49% error rate)", () => {
  const m = makeMetrics({ sampleSize: 10, successCount: 8, errorCount: 2 });
  assert.equal(classifyProviderStatus(m).circuitState, "half_open");
});

test("circuitState open when error rate >= 50%", () => {
  const m = makeMetrics({ sampleSize: 10, successCount: 5, errorCount: 5 });
  assert.equal(classifyProviderStatus(m).circuitState, "open");
});

test("circuitState open when circuitBreakerTriggered=true", () => {
  const m = makeMetrics({
    sampleSize: 10,
    successCount: 10,
    errorCount: 0,
    circuitBreakerTriggered: true,
  });
  assert.equal(classifyProviderStatus(m).circuitState, "open");
});

// ── 5. Latency percentile ─────────────────────────────────────────────────────

test("computes p50 and p95 from latency values", () => {
  const latency = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  const m = makeMetrics({
    sampleSize: 10,
    successCount: 10,
    errorCount: 0,
    latencyValues: latency,
  });
  const result = classifyProviderStatus(m);
  assert.ok(result.latencyMsP50 !== null, "p50 should not be null");
  assert.ok(result.latencyMsP95 !== null, "p95 should not be null");
  assert.ok(
    result.latencyMsP95! >= 900,
    `p95 should be >= 900, got ${result.latencyMsP95}`,
  );
  assert.ok(
    result.latencyMsP95! <= 1000,
    `p95 should be <= 1000, got ${result.latencyMsP95}`,
  );
});

test("returns null p50/p95 when no latency values", () => {
  const m = makeMetrics({
    sampleSize: 10,
    successCount: 10,
    errorCount: 0,
    latencyValues: [],
  });
  const result = classifyProviderStatus(m);
  assert.equal(result.latencyMsP50, null);
  assert.equal(result.latencyMsP95, null);
});

// ── 6. computeProviderHealthFromEvents — empty ────────────────────────────────

test("computeProviderHealthFromEvents returns [] for no events", () => {
  const result = computeProviderHealthFromEvents([]);
  assert.deepEqual(result, []);
});

// ── 7. LLM events ────────────────────────────────────────────────────────────

test("counts groq successes from llm.provider_selected", () => {
  const events = Array(5)
    .fill(null)
    .map(() => makeEvent("llm.provider_selected", { provider: "groq" }));
  const result = computeProviderHealthFromEvents(events);
  const groq = result.find((r) => r.provider === "groq");
  assert.ok(groq, "groq provider should exist");
  assert.equal(groq!.sampleSize, 5);
  assert.equal(groq!.status, "healthy");
});

test("marks groq degraded when error events are present", () => {
  const events = [
    ...Array(8)
      .fill(null)
      .map(() => makeEvent("llm.provider_selected", { provider: "groq" })),
    ...Array(2)
      .fill(null)
      .map(() =>
        makeEvent("llm.provider_down", {
          provider: "groq",
          error_code: "timeout",
        }),
      ),
  ];
  const result = computeProviderHealthFromEvents(events);
  const groq = result.find((r) => r.provider === "groq");
  assert.ok(groq, "groq provider should exist");
  assert.equal(groq!.status, "degraded");
  assert.equal(groq!.lastErrorCode, "timeout");
});

test("marks groq down on >= 40% error rate", () => {
  const events = [
    ...Array(6)
      .fill(null)
      .map(() => makeEvent("llm.provider_selected", { provider: "groq" })),
    ...Array(5)
      .fill(null)
      .map(() => makeEvent("llm.provider_down", { provider: "groq" })),
  ];
  const result = computeProviderHealthFromEvents(events);
  const groq = result.find((r) => r.provider === "groq");
  assert.equal(groq!.status, "down");
});

// ── 8. Fallback events ────────────────────────────────────────────────────────

test("counts fallbacks and marks provider degraded", () => {
  const events = [
    ...Array(4)
      .fill(null)
      .map(() => makeEvent("llm.provider_selected", { provider: "groq" })),
    makeEvent("llm.fallback_selected", { from: "groq", to: "openai" }),
    makeEvent("llm.fallback_selected", { from: "groq", to: "openai" }),
  ];
  const result = computeProviderHealthFromEvents(events);
  const groq = result.find((r) => r.provider === "groq");
  assert.ok(groq, "groq should exist");
  assert.equal(groq!.fallbackCount, 2);
  assert.equal(groq!.fallbackProvider, "openai");
  assert.equal(groq!.status, "degraded");
});

// ── 9. Webhook events ─────────────────────────────────────────────────────────

test("counts webhook sent/failed events", () => {
  const events = [
    ...Array(8)
      .fill(null)
      .map(() => makeEvent("webhook.sent")),
    makeEvent("webhook.failed", { http_status: 500 }),
    makeEvent("webhook.failed", { http_status: 503 }),
  ];
  const result = computeProviderHealthFromEvents(events);
  const wh = result.find((r) => r.provider === "webhook");
  assert.ok(wh, "webhook provider should exist");
  assert.equal(wh!.sampleSize, 10);
  assert.equal(wh!.lastErrorCode, "503");
});

// ── 10. Post-call job events ──────────────────────────────────────────────────

test("counts post_call_jobs completed and dead_letter events", () => {
  const events = [
    ...Array(5)
      .fill(null)
      .map(() => makeEvent("post_call_jobs.completed")),
    makeEvent("post_call_jobs.dead_letter", { error_message: "exhausted" }),
    makeEvent("post_call_jobs.dead_letter", { error_message: "exhausted" }),
  ];
  const result = computeProviderHealthFromEvents(events);
  const jobs = result.find((r) => r.provider === "post_call_jobs");
  assert.ok(jobs, "post_call_jobs provider should exist");
  assert.equal(jobs!.sampleSize, 7);
  assert.equal(jobs!.lastErrorCode, "dead_letter");
});

// ── 11. Billing circuit_breaker_triggered ────────────────────────────────────

test("marks supabase circuit on billing.circuit_breaker_triggered", () => {
  const events = [
    ...Array(5)
      .fill(null)
      .map(() => makeEvent("billing.preflight_passed")),
    makeEvent("billing.circuit_breaker_triggered"),
  ];
  const result = computeProviderHealthFromEvents(events);
  const db = result.find((r) => r.provider === "supabase");
  assert.ok(db, "supabase provider should exist");
  assert.equal(db!.lastErrorCode, "billing_circuit_breaker");
});

// ── 12. Mixed providers ───────────────────────────────────────────────────────

test("separates groq (llm) and cartesia (tts) from mixed events", () => {
  const events = [
    ...Array(5)
      .fill(null)
      .map(() => makeEvent("llm.provider_selected", { provider: "groq" })),
    ...Array(5)
      .fill(null)
      .map(() => makeEvent("tts.provider_selected", { provider: "cartesia" })),
    makeEvent("tts.provider_down", { provider: "cartesia" }),
  ];
  const result = computeProviderHealthFromEvents(events);
  const groq = result.find((r) => r.provider === "groq");
  const cartesia = result.find((r) => r.provider === "cartesia");
  assert.ok(groq, "groq should exist");
  assert.ok(cartesia, "cartesia should exist");
  assert.equal(groq!.status, "healthy");
  assert.equal(groq!.providerType, "llm");
  assert.equal(cartesia!.providerType, "tts");
});

test("TTS latency captured from tts.first_audio_slow events", () => {
  const events = [
    ...Array(5)
      .fill(null)
      .map(() => makeEvent("tts.provider_selected", { provider: "cartesia" })),
    makeEvent("tts.first_audio_slow", { provider: "cartesia", ttfb_ms: 3500 }),
  ];
  const result = computeProviderHealthFromEvents(events);
  const cartesia = result.find((r) => r.provider === "cartesia");
  assert.ok(cartesia, "cartesia should exist");
  assert.equal(cartesia!.status, "degraded");
});

// ── 13. HEALTH_THRESHOLDS invariants ─────────────────────────────────────────

test("HEALTH_THRESHOLDS: degraded < down for error rate", () => {
  assert.ok(
    HEALTH_THRESHOLDS.ERROR_RATE_DEGRADED < HEALTH_THRESHOLDS.ERROR_RATE_DOWN,
  );
});

test("HEALTH_THRESHOLDS: circuit open >= error rate down", () => {
  assert.ok(
    HEALTH_THRESHOLDS.CIRCUIT_OPEN_ERROR_RATE >=
      HEALTH_THRESHOLDS.ERROR_RATE_DOWN,
  );
});

test("HEALTH_THRESHOLDS: degraded < down for latency", () => {
  assert.ok(
    HEALTH_THRESHOLDS.LATENCY_MS_DEGRADED < HEALTH_THRESHOLDS.LATENCY_MS_DOWN,
  );
});

test("HEALTH_THRESHOLDS: MIN_SAMPLE >= 1", () => {
  assert.ok(HEALTH_THRESHOLDS.MIN_SAMPLE_FOR_CLASSIFICATION >= 1);
});
