/**
 * Tests for BillingTracker
 *
 * Validates that usage records are correctly accumulated, priced against
 * provider_costs, inserted into call_cost_events, and summarised on the
 * calls row — all using in-memory stubs (no real DB connections).
 *
 * Run with: pnpm tsx agent/tests/billing-tracker.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BillingTracker } from "../persistence/billing-tracker.js";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Supabase stub factory ─────────────────────────────────────────────────────

interface StubRow {
  table: string;
  op: "insert" | "update";
  data: Record<string, unknown> | Record<string, unknown>[];
  filter?: Record<string, unknown>;
}

function makeStub(providerCosts: Record<string, unknown> | null = null) {
  const log: StubRow[] = [];

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
          insert: (rows: Record<string, unknown>[]) => {
            log.push({ table, op: "insert", data: rows });
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === "calls") {
        return {
          update: (patch: Record<string, unknown>) => ({
            eq: (_col: string, _val: string) => {
              log.push({ table, op: "update", data: patch });
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      return {};
    },
    _log: log,
  } as unknown as SupabaseClient & { _log: StubRow[] };

  return stub;
}

const COSTS = {
  twilio_outbound_per_min: 0.85,
  twilio_inbound_per_min: 0.85,
  livekit_per_min: 0.2,
  stt_per_min: 0.59,
  llm_per_1k_tokens: 0.06,
  tts_per_1k_chars: 0.65,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

test("trackTelephony: records telephony event with correct quantity", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-1", "ws-1", "agent-1");
  bt.trackTelephony(120, "outbound");
  await bt.computeAndPersist("call-id-1", sb);

  const insertEntry = sb._log.find((l) => l.table === "call_cost_events");
  assert.ok(insertEntry, "should insert cost events");
  const rows = insertEntry!.data as Record<string, unknown>[];
  const tel = rows.find((r) => r["cost_type"] === "telephony");
  assert.ok(tel, "telephony row should exist");
  assert.equal(tel!["provider"], "twilio");
  assert.equal(tel!["unit"], "minutes");
  assert.ok(Math.abs((tel!["quantity"] as number) - 2) < 1e-9, "120s = 2 min");
  assert.equal(tel!["pricing_source"], "configured");
  assert.ok(tel!["total_cost_usd"] !== null, "total_cost_usd should be set");
});

test("trackTelephony: null costs → pricing_source=unknown, null total", async () => {
  const sb = makeStub(null); // no costs configured
  const bt = new BillingTracker("room-2", "ws-1");
  bt.trackTelephony(60, "inbound");
  await bt.computeAndPersist("call-id-2", sb);

  const insertEntry = sb._log.find((l) => l.table === "call_cost_events");
  const rows = insertEntry!.data as Record<string, unknown>[];
  const tel = rows.find((r) => r["cost_type"] === "telephony");
  assert.equal(tel!["pricing_source"], "unknown");
  assert.equal(tel!["total_cost_usd"], null);
  assert.equal(tel!["unit_cost_usd"], null);
});

test("trackTTS: accumulates chars; skips if 0", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-3", "ws-1");
  bt.trackTTS(0); // should be skipped
  bt.trackTTS(500);
  await bt.computeAndPersist("call-id-3", sb);

  const insertEntry = sb._log.find((l) => l.table === "call_cost_events");
  const rows = insertEntry!.data as Record<string, unknown>[];
  assert.equal(rows.length, 1, "only one TTS row");
  assert.equal(rows[0]!["cost_type"], "tts");
  assert.equal(rows[0]!["quantity"], 500);
  assert.equal(rows[0]!["unit"], "characters");
});

test("trackLLMTokens: skips if 0", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-4", "ws-1");
  bt.trackLLMTokens(0);
  await bt.computeAndPersist("call-id-4", sb);
  // Nothing tracked → nothing inserted
  assert.equal(sb._log.length, 0);
});

test("computeAndPersist: updates calls row with cost_usd and cost_breakdown when callId provided", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-5", "ws-1", "agent-5");
  bt.trackTelephony(60, "outbound"); // 1 min × $0.0085 = $0.0085
  bt.trackLiveKit(60); // 1 min × $0.002  = $0.002
  await bt.computeAndPersist("call-id-5", sb);

  const updateEntry = sb._log.find(
    (l) => l.table === "calls" && l.op === "update",
  );
  assert.ok(updateEntry, "calls update should be present");
  const patch = updateEntry!.data as Record<string, unknown>;
  assert.equal(patch["cost_status"], "estimated");
  assert.ok(typeof patch["cost_usd"] === "number", "cost_usd should be numeric");
  assert.ok(
    (patch["cost_usd"] as number) > 0,
    "cost_usd > 0 when all priced",
  );
  assert.ok(
    patch["cost_breakdown"] !== null,
    "cost_breakdown should be set",
  );
});

test("computeAndPersist: cost_status=not_calculated when any pricing is unknown", async () => {
  const sb = makeStub(null); // no costs
  const bt = new BillingTracker("room-6", "ws-1");
  bt.trackTelephony(60, "outbound");
  await bt.computeAndPersist("call-id-6", sb);

  const updateEntry = sb._log.find(
    (l) => l.table === "calls" && l.op === "update",
  );
  const patch = updateEntry!.data as Record<string, unknown>;
  assert.equal(patch["cost_status"], "not_calculated");
  assert.equal(patch["cost_usd"], 0, "cost_usd=0 when pricing unknown");
});

test("computeAndPersist: no callId → skips calls update", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-7", "ws-1");
  bt.trackTelephony(30, "inbound");
  await bt.computeAndPersist(null, sb);

  const callsUpdate = sb._log.find((l) => l.table === "calls");
  assert.equal(callsUpdate, undefined, "no calls update when callId is null");
  const insertEntry = sb._log.find((l) => l.table === "call_cost_events");
  assert.ok(insertEntry, "cost events still inserted even without callId");
});

test("computeAndPersist: empty usage → no DB calls", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-8", "ws-1");
  await bt.computeAndPersist("call-id-8", sb);
  assert.equal(sb._log.length, 0, "no DB calls when nothing tracked");
});

test("computeAndPersist: swallows DB errors without throwing", async () => {
  const badStub = {
    from: () => {
      throw new Error("db connection reset");
    },
  } as unknown as SupabaseClient;

  const bt = new BillingTracker("room-9", "ws-1");
  bt.trackTelephony(60, "outbound");
  // Must not throw
  await assert.doesNotReject(() => bt.computeAndPersist("call-id-9", badStub));
});

console.log("✓ billing-tracker tests complete");
