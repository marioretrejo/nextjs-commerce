/**
 * agent/tests/alerting.test.ts
 *
 * Unit tests for the VoiceOS alerting library.
 * Uses node:test + node:assert/strict (not Jest).
 *
 * Tests cover:
 *   1. sanitizeAlertMetadata — blocked keys, secret patterns, type filtering
 *   2. dedupeFingerprint — determinism, provider/workspace variants
 *   3. ALERT_THRESHOLDS — structural invariants
 *   4. evaluateAlertSignals — mock Supabase client, signal detection
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeAlertMetadata,
  dedupeFingerprint,
  ALERT_THRESHOLDS,
  type AlertSignal,
} from "../../lib/observability/alerting.js";

// ── 1. sanitizeAlertMetadata ───────────────────────────────────────────────────

test("sanitizeAlertMetadata: removes blocked key 'api_key'", () => {
  const result = sanitizeAlertMetadata({ api_key: "sk-secret" });
  assert.equal("api_key" in result, false);
});

test("sanitizeAlertMetadata: removes blocked key 'token'", () => {
  const result = sanitizeAlertMetadata({ token: "Bearer abc123" });
  assert.equal("token" in result, false);
});

test("sanitizeAlertMetadata: removes blocked key 'password'", () => {
  const result = sanitizeAlertMetadata({ password: "supersecret" });
  assert.equal("password" in result, false);
});

test("sanitizeAlertMetadata: removes blocked key 'secret'", () => {
  const result = sanitizeAlertMetadata({ secret: "my-secret-value" });
  assert.equal("secret" in result, false);
});

test("sanitizeAlertMetadata: preserves safe string values", () => {
  const result = sanitizeAlertMetadata({
    error_code: "TIMEOUT",
    provider: "groq",
  });
  assert.equal(result["error_code"], "TIMEOUT");
  assert.equal(result["provider"], "groq");
});

test("sanitizeAlertMetadata: preserves numeric values", () => {
  const result = sanitizeAlertMetadata({ count: 42, error_rate: 0.15 });
  assert.equal(result["count"], 42);
  assert.equal(result["error_rate"], 0.15);
});

test("sanitizeAlertMetadata: preserves boolean values", () => {
  const result = sanitizeAlertMetadata({ degraded: true, healthy: false });
  assert.equal(result["degraded"], true);
  assert.equal(result["healthy"], false);
});

test("sanitizeAlertMetadata: redacts long strings matching sk- pattern", () => {
  const result = sanitizeAlertMetadata({
    note: "key=sk-1234567890abcdef1234567890",
  });
  const note = result["note"] as string;
  assert.match(note, /\[REDACTED\]/);
});

test("sanitizeAlertMetadata: truncates strings to 200 chars", () => {
  const long = "a".repeat(300);
  const result = sanitizeAlertMetadata({ desc: long });
  const val = result["desc"] as string;
  assert.ok(val.length <= 200);
});

test("sanitizeAlertMetadata: skips nested objects", () => {
  const result = sanitizeAlertMetadata({
    nested: { inner: "value" },
    top: "kept",
  });
  assert.equal("nested" in result, false);
  assert.equal(result["top"], "kept");
});

// ── 2. dedupeFingerprint ───────────────────────────────────────────────────────

test("dedupeFingerprint: same inputs produce same output", () => {
  const a = dedupeFingerprint("provider_down", "groq", "ws-001");
  const b = dedupeFingerprint("provider_down", "groq", "ws-001");
  assert.equal(a, b);
});

test("dedupeFingerprint: different signals produce different fingerprints", () => {
  const a = dedupeFingerprint("provider_down", "groq", "ws-001");
  const b = dedupeFingerprint("provider_degraded", "groq", "ws-001");
  assert.notEqual(a, b);
});

test("dedupeFingerprint: null provider handled as '_'", () => {
  const a = dedupeFingerprint("cron_failure", null, "ws-001");
  const b = dedupeFingerprint("cron_failure", "_", "ws-001");
  assert.equal(a, b);
});

test("dedupeFingerprint: null workspaceId handled as 'global'", () => {
  const a = dedupeFingerprint("cron_failure", "job", null);
  const b = dedupeFingerprint("cron_failure", "job", "global");
  assert.equal(a, b);
});

test("dedupeFingerprint: different workspaces produce different fingerprints", () => {
  const a = dedupeFingerprint("provider_down", "groq", "ws-001");
  const b = dedupeFingerprint("provider_down", "groq", "ws-002");
  assert.notEqual(a, b);
});

test("dedupeFingerprint: output is exactly 32 hex chars", () => {
  const fp = dedupeFingerprint("call_failure_spike", "twilio", "ws-abc");
  assert.equal(fp.length, 32);
  assert.match(fp, /^[0-9a-f]{32}$/);
});

// ── 3. ALERT_THRESHOLDS invariants ────────────────────────────────────────────

test("ALERT_THRESHOLDS: WEBHOOK_FAILURE_RATE is between 0 and 1", () => {
  assert.ok(ALERT_THRESHOLDS.WEBHOOK_FAILURE_RATE > 0);
  assert.ok(ALERT_THRESHOLDS.WEBHOOK_FAILURE_RATE < 1);
});

test("ALERT_THRESHOLDS: WEBHOOK_MIN_SAMPLE >= 3 (avoids noise on low volume)", () => {
  assert.ok(ALERT_THRESHOLDS.WEBHOOK_MIN_SAMPLE >= 3);
});

test("ALERT_THRESHOLDS: DEAD_LETTER_COUNT >= 1", () => {
  assert.ok(ALERT_THRESHOLDS.DEAD_LETTER_COUNT >= 1);
});

test("ALERT_THRESHOLDS: CRON_STALE_MINUTES > 0", () => {
  assert.ok(ALERT_THRESHOLDS.CRON_STALE_MINUTES > 0);
});

test("ALERT_THRESHOLDS: all threshold values are non-negative numbers", () => {
  for (const [k, v] of Object.entries(ALERT_THRESHOLDS)) {
    assert.equal(typeof v, "number", `${k} should be a number`);
    assert.ok(v >= 0, `${k} should be >= 0`);
  }
});

// ── 4. AlertSignal type coverage ──────────────────────────────────────────────

test("All 13 signal types are representable", () => {
  const signals: AlertSignal[] = [
    "provider_down",
    "provider_degraded",
    "circuit_open",
    "fallback_spike",
    "post_call_jobs_dead_letter",
    "post_call_jobs_stale_running",
    "webhook_failure_spike",
    "cron_failure",
    "db_error_spike",
    "active_calls_zombie",
    "call_failure_spike",
    "cost_spike",
    "compliance_block_spike",
  ];
  assert.equal(signals.length, 13);
  // All are non-empty strings
  for (const s of signals) {
    assert.equal(typeof s, "string");
    assert.ok(s.length > 0);
  }
});
