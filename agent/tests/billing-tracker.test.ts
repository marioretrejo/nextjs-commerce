/**
 * Tests for BillingTracker (Fase 7 audit)
 *
 * Covers: usage accumulation, cost_status correctness (estimated / partial /
 * not_calculated / failed), metadata fields, TTS accumulation across multiple
 * trackedSay calls, and error isolation.
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
}

function makeStub(
  providerCosts: Record<string, unknown> | null = null,
  insertError: { message: string } | null = null,
) {
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
            return Promise.resolve({ error: insertError });
          },
          update: (patch: Record<string, unknown>) => ({
            eq: (_c1: string, _v1: string) => ({
              eq: (_c2: string, _v2: string) => ({
                is: (_c3: string, _v3: null) => {
                  log.push({ table, op: "update", data: patch });
                  return Promise.resolve({ error: null });
                },
              }),
            }),
          }),
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

// Partial config: telephony + LiveKit + STT configured, LLM + TTS missing
const PARTIAL_COSTS = {
  twilio_outbound_per_min: 0.85,
  twilio_inbound_per_min: 0.85,
  livekit_per_min: 0.2,
  stt_per_min: 0.59,
  // llm_per_1k_tokens: intentionally missing
  // tts_per_1k_chars: intentionally missing
};

// ── Telephony ─────────────────────────────────────────────────────────────────

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
  const sb = makeStub(null);
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

test("trackTelephony: metadata has estimation_method and confidence", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-m1", "ws-1");
  bt.trackTelephony(60, "outbound");
  await bt.computeAndPersist("call-m1", sb);

  const rows = sb._log.find((l) => l.table === "call_cost_events")!
    .data as Record<string, unknown>[];
  const tel = rows.find((r) => r["cost_type"] === "telephony")!;
  const meta = tel["metadata"] as Record<string, unknown>;
  assert.equal(meta["estimation_method"], "call_duration_seconds");
  assert.equal(meta["confidence"], "medium");
  assert.equal(meta["pricing_unit"], "usd_per_minute");
  // Pricing metadata injected by _priceUsage
  assert.ok("raw_rate_cents" in meta, "raw_rate_cents should be in metadata");
  assert.ok("calculation" in meta, "calculation string should be present");
});

// ── TTS accumulation ──────────────────────────────────────────────────────────

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

test("trackTTS: multiple calls accumulate into single row with correct total", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-acc", "ws-1");
  bt.trackTTS(100); // greeting
  bt.trackTTS(50); // silence reprompt
  bt.trackTTS(80); // watchdog filler
  bt.trackTTS(120); // farewell
  await bt.computeAndPersist("call-acc", sb);

  const rows = sb._log.find((l) => l.table === "call_cost_events")!
    .data as Record<string, unknown>[];
  const tts = rows.find((r) => r["cost_type"] === "tts")!;
  assert.equal(tts["quantity"], 350, "sum of all tracked chars");
  const meta = tts["metadata"] as Record<string, unknown>;
  assert.equal(meta["say_count"], 4, "tracks number of say() calls");
  assert.equal(meta["estimation_method"], "tracked_session_say_text_length");
  assert.equal(meta["confidence"], "medium");
});

test("trackTTS: only one TTS row even with many calls (no duplicate rows)", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-nodup", "ws-1");
  for (let i = 0; i < 10; i++) bt.trackTTS(20);
  await bt.computeAndPersist("call-nodup", sb);

  const rows = sb._log.find((l) => l.table === "call_cost_events")!
    .data as Record<string, unknown>[];
  const ttsRows = rows.filter((r) => r["cost_type"] === "tts");
  assert.equal(
    ttsRows.length,
    1,
    "exactly one TTS cost event regardless of call count",
  );
  assert.equal(ttsRows[0]!["quantity"], 200, "200 total chars");
});

// ── LLM tokens ────────────────────────────────────────────────────────────────

test("trackLLMTokens: skips if 0", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-4", "ws-1");
  bt.trackLLMTokens(0);
  await bt.computeAndPersist("call-id-4", sb);
  assert.equal(sb._log.length, 0);
});

test("trackLLMTokens: metadata has confidence=low and estimation_method", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-llm", "ws-1");
  bt.trackLLMTokens(300);
  await bt.computeAndPersist("call-llm", sb);

  const rows = sb._log.find((l) => l.table === "call_cost_events")!
    .data as Record<string, unknown>[];
  const llm = rows.find((r) => r["cost_type"] === "llm")!;
  const meta = llm["metadata"] as Record<string, unknown>;
  assert.equal(
    meta["confidence"],
    "low",
    "LLM token counts are low-confidence estimates",
  );
  assert.equal(meta["estimation_method"], "transcript_chars_divided_by_3");
  assert.equal(meta["pricing_unit"], "usd_per_1k_tokens");
});

// ── cost_status classification ────────────────────────────────────────────────

test("cost_status=estimated when all costs are configured", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-5", "ws-1", "agent-5");
  bt.trackTelephony(60, "outbound");
  bt.trackLiveKit(60);
  await bt.computeAndPersist("call-id-5", sb);

  const patch = sb._log.find((l) => l.table === "calls" && l.op === "update")!
    .data as Record<string, unknown>;
  assert.equal(patch["cost_status"], "estimated");
  assert.ok((patch["cost_usd"] as number) > 0);
});

test("cost_status=not_calculated when ALL pricing is unknown (no costs row)", async () => {
  const sb = makeStub(null);
  const bt = new BillingTracker("room-6", "ws-1");
  bt.trackTelephony(60, "outbound");
  await bt.computeAndPersist("call-id-6", sb);

  const patch = sb._log.find((l) => l.table === "calls" && l.op === "update")!
    .data as Record<string, unknown>;
  assert.equal(patch["cost_status"], "not_calculated");
  assert.equal(patch["cost_usd"], 0);
});

test("cost_status=partial when some costs configured, some unknown", async () => {
  // PARTIAL_COSTS has telephony/STT/LiveKit but no TTS/LLM rates
  const sb = makeStub(PARTIAL_COSTS);
  const bt = new BillingTracker("room-partial", "ws-1");
  bt.trackTelephony(60, "outbound"); // configured → priced
  bt.trackTTS(200); // no tts_per_1k_chars → unknown
  await bt.computeAndPersist("call-partial", sb);

  const patch = sb._log.find((l) => l.table === "calls" && l.op === "update")!
    .data as Record<string, unknown>;
  assert.equal(
    patch["cost_status"],
    "partial",
    "some configured + some unknown → partial",
  );
  // cost_usd should reflect only the priced portion
  assert.ok(
    (patch["cost_usd"] as number) > 0,
    "priced portion contributes to cost_usd",
  );
});

test("cost_status=failed when DB insert fails, calls row updated to failed", async () => {
  const sb = makeStub(COSTS, { message: "unique constraint violation" });
  const bt = new BillingTracker("room-fail", "ws-1");
  bt.trackTelephony(60, "outbound");
  await bt.computeAndPersist("call-fail", sb);

  const callsUpdate = sb._log.find(
    (l) => l.table === "calls" && l.op === "update",
  );
  assert.ok(callsUpdate, "calls row should be updated to reflect failure");
  const patch = callsUpdate!.data as Record<string, unknown>;
  assert.equal(patch["cost_status"], "failed");
  // cost_usd should NOT be written on failure
  assert.equal(patch["cost_usd"], undefined);
});

// ── Misc ──────────────────────────────────────────────────────────────────────

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
  await assert.doesNotReject(() => bt.computeAndPersist("call-id-9", badStub));
});

test("backfillCallId: runs without error when no null events exist", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-bf", "ws-1");
  await assert.doesNotReject(() => bt.backfillCallId("call-bf", sb));
});

console.log("✓ billing-tracker tests complete");
