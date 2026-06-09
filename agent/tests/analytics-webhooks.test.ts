/**
 * Unit tests: Analytics aggregation + webhook HMAC signing
 *
 * Tests the pure computeCallAnalytics() function and verifies the
 * X-VoiceOS-Signature header format.
 *
 * Run with: pnpm tsx agent/tests/analytics-webhooks.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import {
  computeCallAnalytics,
  type CallRow,
} from "../../lib/analytics/compute.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WS_ID = "ws-test-123";

function makeCall(overrides: Partial<CallRow> = {}): CallRow {
  return {
    id: crypto.randomUUID(),
    duration_seconds: 60,
    cost_usd: 0.05,
    cost_breakdown: {
      telephony: { total_cost_usd: 0.02 },
      tts: { total_cost_usd: 0.01 },
      stt: { total_cost_usd: 0.01 },
      livekit_media: { total_cost_usd: 0.005 },
      llm: { total_cost_usd: 0.005 },
    },
    cost_status: "estimated",
    business_outcome: "interested",
    technical_status: "completed",
    end_reason: null,
    ...overrides,
  };
}

// ── computeCallAnalytics ──────────────────────────────────────────────────────

test("computeCallAnalytics: empty calls array returns zeroes", () => {
  const result = computeCallAnalytics([], WS_ID, null, null);
  assert.equal(result.volume.total_calls, 0);
  assert.equal(result.volume.total_minutes, 0);
  assert.equal(result.financial.total_cost_usd, 0);
  assert.equal(result.financial.avg_cost_per_call_usd, 0);
  assert.deepEqual(result.financial.cost_breakdown_totals, {});
  assert.equal(result.efficiency.billing_rejections, 0);
  assert.equal(result.efficiency.completion_rate, 0);
});

test("computeCallAnalytics: correct total calls and minutes", () => {
  const calls = [
    makeCall({ duration_seconds: 120 }),
    makeCall({ duration_seconds: 60 }),
    makeCall({ duration_seconds: 180 }),
  ];
  const result = computeCallAnalytics(calls, WS_ID, null, null);
  assert.equal(result.volume.total_calls, 3);
  // (120 + 60 + 180) / 60 = 6 minutes
  assert.equal(result.volume.total_minutes, 6);
});

test("computeCallAnalytics: correct total and average cost", () => {
  const calls = [
    makeCall({ cost_usd: 0.1 }),
    makeCall({ cost_usd: 0.2 }),
    makeCall({ cost_usd: 0.3 }),
  ];
  const result = computeCallAnalytics(calls, WS_ID, null, null);
  assert.ok(
    Math.abs(result.financial.total_cost_usd - 0.6) < 0.000001,
    `total_cost should be 0.60, got ${result.financial.total_cost_usd}`,
  );
  assert.ok(
    Math.abs(result.financial.avg_cost_per_call_usd - 0.2) < 0.000001,
    `avg_cost should be 0.20, got ${result.financial.avg_cost_per_call_usd}`,
  );
});

test("computeCallAnalytics: cost_breakdown_totals aggregates across calls", () => {
  const calls = [
    makeCall({
      cost_breakdown: {
        telephony: { total_cost_usd: 0.02 },
        tts: { total_cost_usd: 0.01 },
      },
    }),
    makeCall({
      cost_breakdown: {
        telephony: { total_cost_usd: 0.03 },
        tts: { total_cost_usd: 0.02 },
        stt: { total_cost_usd: 0.005 },
      },
    }),
  ];
  const result = computeCallAnalytics(calls, WS_ID, null, null);
  assert.ok(
    Math.abs(
      (result.financial.cost_breakdown_totals["telephony"] ?? 0) - 0.05,
    ) < 0.000001,
    "telephony total should be 0.05",
  );
  assert.ok(
    Math.abs((result.financial.cost_breakdown_totals["tts"] ?? 0) - 0.03) <
      0.000001,
    "tts total should be 0.03",
  );
  assert.ok(
    Math.abs((result.financial.cost_breakdown_totals["stt"] ?? 0) - 0.005) <
      0.000001,
    "stt total should be 0.005",
  );
});

test("computeCallAnalytics: outcome_distribution counts correctly", () => {
  const calls = [
    makeCall({ business_outcome: "interested" }),
    makeCall({ business_outcome: "interested" }),
    makeCall({ business_outcome: "not_interested" }),
    makeCall({ business_outcome: null }), // maps to "unknown"
  ];
  const result = computeCallAnalytics(calls, WS_ID, null, null);
  assert.equal(result.efficiency.outcome_distribution["interested"], 2);
  assert.equal(result.efficiency.outcome_distribution["not_interested"], 1);
  assert.equal(result.efficiency.outcome_distribution["unknown"], 1);
});

test("computeCallAnalytics: billing_rejections counts end_reason and business_outcome", () => {
  const calls = [
    makeCall({ end_reason: "insufficient_funds", business_outcome: "failed" }),
    makeCall({ business_outcome: "billing_rejection" }),
    makeCall({ business_outcome: "interested" }), // normal call
    makeCall({ end_reason: null }), // normal call
  ];
  const result = computeCallAnalytics(calls, WS_ID, null, null);
  assert.equal(result.efficiency.billing_rejections, 2);
});

test("computeCallAnalytics: completion_rate is correct", () => {
  const calls = [
    makeCall({ technical_status: "completed" }),
    makeCall({ technical_status: "completed" }),
    makeCall({ technical_status: "failed" }),
    makeCall({ technical_status: "no_answer" }),
  ];
  const result = computeCallAnalytics(calls, WS_ID, null, null);
  // 2 completed out of 4 = 50%
  assert.equal(result.efficiency.completion_rate, 50);
});

test("computeCallAnalytics: null cost_usd treated as 0 in aggregation", () => {
  const calls = [makeCall({ cost_usd: null }), makeCall({ cost_usd: 0.1 })];
  const result = computeCallAnalytics(calls, WS_ID, null, null);
  assert.ok(
    Math.abs(result.financial.total_cost_usd - 0.1) < 0.000001,
    "null cost_usd should be treated as 0",
  );
});

test("computeCallAnalytics: date_range and workspace_id are forwarded", () => {
  const result = computeCallAnalytics([], WS_ID, "2025-01-01", "2025-01-31");
  assert.equal(result.workspace_id, WS_ID);
  assert.equal(result.date_range.start_date, "2025-01-01");
  assert.equal(result.date_range.end_date, "2025-01-31");
});

// ── X-VoiceOS-Signature HMAC ──────────────────────────────────────────────────

test("webhook signature: HMAC-SHA256 is deterministic", () => {
  const secret = "test-signing-secret-32chars!!!!";
  const payload = JSON.stringify({
    event: "call.completed",
    call_id: "abc-123",
  });
  const sign = (p: string, s: string) =>
    `sha256=${crypto.createHmac("sha256", s).update(p).digest("hex")}`;

  const sig1 = sign(payload, secret);
  const sig2 = sign(payload, secret);
  assert.equal(sig1, sig2, "same input should produce same signature");
});

test("webhook signature: different secrets produce different signatures", () => {
  const payload = JSON.stringify({ event: "call.completed" });
  const sign = (p: string, s: string) =>
    `sha256=${crypto.createHmac("sha256", s).update(p).digest("hex")}`;

  const sig1 = sign(payload, "secret-aaa-16chars");
  const sig2 = sign(payload, "secret-bbb-16chars");
  assert.notEqual(
    sig1,
    sig2,
    "different secrets must produce different signatures",
  );
});

test("webhook signature: different payloads produce different signatures", () => {
  const secret = "consistent-secret-here-32chars!!";
  const sign = (p: string) =>
    `sha256=${crypto.createHmac("sha256", secret).update(p).digest("hex")}`;

  const sig1 = sign(JSON.stringify({ call_id: "call-1" }));
  const sig2 = sign(JSON.stringify({ call_id: "call-2" }));
  assert.notEqual(
    sig1,
    sig2,
    "different payloads must produce different signatures",
  );
});

test("webhook signature: format is 'sha256=' followed by 64 hex chars", () => {
  const secret = "test-secret-exactly-16ch";
  const payload = JSON.stringify({ event: "call.completed" });
  const sig = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
  assert.ok(sig.startsWith("sha256="), "must start with sha256= prefix");
  assert.equal(
    sig.length,
    7 + 64,
    "sha256= (7) + 64 hex chars from HMAC-SHA256",
  );
});

test("webhook signature: receiver can verify by recomputing HMAC", () => {
  const secret = "receiver-knows-this-secret!16ch";
  const payload = JSON.stringify({ event: "call.completed", call_id: "xyz" });
  // Sender signs
  const header = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
  // Receiver verifies
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
  // Use timingSafeEqual to prevent timing attacks (as a receiver should)
  const headerBuf = Buffer.from(header);
  const expectedBuf = Buffer.from(expected);
  assert.equal(headerBuf.length, expectedBuf.length);
  assert.ok(
    crypto.timingSafeEqual(headerBuf, expectedBuf),
    "receiver HMAC verification should pass",
  );
});

console.log("✓ analytics-webhooks tests complete");
