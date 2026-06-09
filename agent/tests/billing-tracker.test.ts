/**
 * Tests for BillingTracker (Fase 7 + Fase 7 audit)
 *
 * Covers: usage accumulation, cost_status correctness (estimated / partial /
 * not_calculated / failed), metadata fields, two-source TTS accumulation
 * (manual_session_say + agent_pipeline_tts), dedupe logic, and error isolation.
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
  assert.ok("raw_rate_cents" in meta, "raw_rate_cents should be in metadata");
  assert.ok("calculation" in meta, "calculation string should be present");
});

// ── TTS — two-source accumulation ─────────────────────────────────────────────

test("trackManualSay: accumulates chars; skips empty string", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-3", "ws-1");
  bt.trackManualSay(""); // should be skipped
  bt.trackManualSay("Hello world"); // 11 chars
  // Simulate ConversationItemAdded firing for the injected text
  bt.trackPipelineTTS("Hello world");
  await bt.computeAndPersist("call-id-3", sb);

  const insertEntry = sb._log.find((l) => l.table === "call_cost_events");
  const rows = insertEntry!.data as Record<string, unknown>[];
  assert.equal(rows.length, 1, "only one TTS row");
  assert.equal(rows[0]!["cost_type"], "tts");
  assert.equal(rows[0]!["quantity"], 11);
});

test("trackManualSay: multiple manual calls accumulate into single row", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-acc", "ws-1");
  const phrases = [
    "Good morning, how can I help you today?", // greeting
    "I understand, let me check that for you.", // silence reprompt
    "Un momento…", // watchdog filler
    "Thank you for calling. Have a great day!", // farewell
  ];
  // Simulate: trackedSay() registers pending, then ConversationItemAdded consumes
  for (const p of phrases) {
    bt.trackManualSay(p);
    bt.trackPipelineTTS(p); // ConversationItemAdded fires for injected text → manual
  }
  await bt.computeAndPersist("call-acc", sb);

  const rows = sb._log.find((l) => l.table === "call_cost_events")!
    .data as Record<string, unknown>[];
  const tts = rows.find((r) => r["cost_type"] === "tts")!;
  const expectedTotal = phrases.reduce((s, p) => s + p.length, 0);
  assert.equal(tts["quantity"], expectedTotal, "sum of all manual chars");
  const meta = tts["metadata"] as Record<string, unknown>;
  const sources = meta["sources"] as Record<string, Record<string, number>>;
  assert.equal(
    sources["manual_session_say"]!["say_count"],
    4,
    "tracks number of manual say() calls",
  );
  assert.equal(
    sources["agent_pipeline_tts"]!["message_count"],
    0,
    "no pipeline responses in this scenario",
  );
  assert.equal(
    meta["estimation_method"],
    "conversation_item_added_with_manual_say_dedup",
  );
  assert.equal(meta["confidence"], "medium");
});

test("trackManualSay: only one TTS row even with many manual calls", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-nodup", "ws-1");
  for (let i = 0; i < 10; i++) {
    const text = "A".repeat(20);
    bt.trackManualSay(text);
    bt.trackPipelineTTS(text); // ConversationItemAdded
  }
  await bt.computeAndPersist("call-nodup", sb);

  const rows = sb._log.find((l) => l.table === "call_cost_events")!
    .data as Record<string, unknown>[];
  const ttsRows = rows.filter((r) => r["cost_type"] === "tts");
  assert.equal(ttsRows.length, 1, "exactly one TTS cost event");
  assert.equal(ttsRows[0]!["quantity"], 200, "200 total chars");
});

test("trackPipelineTTS: LLM response without prior trackManualSay → agent_pipeline_tts", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-pipe", "ws-1");
  const agentReply =
    "Sure, I can help you with that! Let me pull up your account.";
  // No trackManualSay call — this is a pure LLM pipeline response
  bt.trackPipelineTTS(agentReply);
  await bt.computeAndPersist("call-pipe", sb);

  const rows = sb._log.find((l) => l.table === "call_cost_events")!
    .data as Record<string, unknown>[];
  const tts = rows.find((r) => r["cost_type"] === "tts")!;
  assert.equal(tts["quantity"], agentReply.length);
  const meta = tts["metadata"] as Record<string, unknown>;
  const sources = meta["sources"] as Record<string, Record<string, number>>;
  assert.equal(
    sources["manual_session_say"]!["characters"],
    0,
    "manual bucket empty",
  );
  assert.equal(
    sources["agent_pipeline_tts"]!["characters"],
    agentReply.length,
    "pipeline bucket has the chars",
  );
  assert.equal(sources["agent_pipeline_tts"]!["message_count"], 1);
  assert.equal(meta["tts_pipeline_visibility"], "captured");
});

test("trackPipelineTTS: same text in trackedSay + ConversationItemAdded is NOT double-counted", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-dedup", "ws-1");
  const text = "Un momento…"; // watchdog filler phrase
  bt.trackManualSay(text); // trackedSay() registers pending
  bt.trackPipelineTTS(text); // ConversationItemAdded consumes pending → manual bucket

  await bt.computeAndPersist("call-dedup", sb);
  const rows = sb._log.find((l) => l.table === "call_cost_events")!
    .data as Record<string, unknown>[];
  const tts = rows.find((r) => r["cost_type"] === "tts")!;
  assert.equal(tts["quantity"], text.length, "each char counted exactly once");
  const meta = tts["metadata"] as Record<string, unknown>;
  const sources = meta["sources"] as Record<string, Record<string, number>>;
  assert.equal(sources["manual_session_say"]!["characters"], text.length);
  assert.equal(sources["agent_pipeline_tts"]!["characters"], 0);
});

test("trackPipelineTTS: mixed call — manual injections + LLM responses", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-mixed", "ws-1");

  const greeting = "Hello! How can I help you today?"; // 31 chars, manual
  const filler = "Un momento…"; // 11 chars, manual (watchdog)
  const farewell = "Thank you for calling!"; // 22 chars, manual
  const llm1 = "Sure, let me look into that for you."; // 36 chars, pipeline
  const llm2 = "I found your account. Your balance is $42.50."; // 46 chars, pipeline

  // Manual injections
  bt.trackManualSay(greeting);
  bt.trackPipelineTTS(greeting); // ConversationItemAdded for greeting
  bt.trackManualSay(filler);
  bt.trackPipelineTTS(filler); // ConversationItemAdded for filler
  bt.trackManualSay(farewell);
  bt.trackPipelineTTS(farewell); // ConversationItemAdded for farewell

  // LLM pipeline (no prior trackManualSay)
  bt.trackPipelineTTS(llm1);
  bt.trackPipelineTTS(llm2);

  await bt.computeAndPersist("call-mixed", sb);
  const rows = sb._log.find((l) => l.table === "call_cost_events")!
    .data as Record<string, unknown>[];
  const tts = rows.find((r) => r["cost_type"] === "tts")!;

  const expectedTotal =
    greeting.length +
    filler.length +
    farewell.length +
    llm1.length +
    llm2.length;
  assert.equal(tts["quantity"], expectedTotal);

  const meta = tts["metadata"] as Record<string, unknown>;
  const sources = meta["sources"] as Record<string, Record<string, number>>;
  assert.equal(
    sources["manual_session_say"]!["characters"],
    greeting.length + filler.length + farewell.length,
  );
  assert.equal(sources["manual_session_say"]!["say_count"], 3);
  assert.equal(
    sources["agent_pipeline_tts"]!["characters"],
    llm1.length + llm2.length,
  );
  assert.equal(sources["agent_pipeline_tts"]!["message_count"], 2);
  assert.equal(meta["tts_pipeline_visibility"], "captured");
});

test("trackManualSay: pending entries flushed at computeAndPersist if ConversationItemAdded never fires", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-flush", "ws-1");
  const greeting = "Hi there, welcome!"; // 18 chars — no trackPipelineTTS call
  bt.trackManualSay(greeting); // registered but never consumed

  await bt.computeAndPersist("call-flush", sb);
  const rows = sb._log.find((l) => l.table === "call_cost_events")!
    .data as Record<string, unknown>[];
  const tts = rows.find((r) => r["cost_type"] === "tts")!;
  assert.ok(tts, "TTS row should still be emitted");
  assert.equal(
    tts["quantity"],
    greeting.length,
    "pending chars flushed as manual",
  );
  const meta = tts["metadata"] as Record<string, unknown>;
  const sources = meta["sources"] as Record<string, Record<string, number>>;
  assert.equal(sources["manual_session_say"]!["characters"], greeting.length);
});

test("tts_pipeline_visibility=manual_only when no pipeline messages captured", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-vis", "ws-1");
  bt.trackManualSay("Goodbye!");
  bt.trackPipelineTTS("Goodbye!"); // consumed → manual bucket
  await bt.computeAndPersist("call-vis", sb);

  const rows = sb._log.find((l) => l.table === "call_cost_events")!
    .data as Record<string, unknown>[];
  const tts = rows.find((r) => r["cost_type"] === "tts")!;
  const meta = tts["metadata"] as Record<string, unknown>;
  assert.equal(meta["tts_pipeline_visibility"], "manual_only");
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
  assert.equal(meta["confidence"], "low");
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
  // 200 chars of TTS — no tts_per_1k_chars → unknown
  bt.trackManualSay("A".repeat(200));
  bt.trackPipelineTTS("A".repeat(200));
  await bt.computeAndPersist("call-partial", sb);

  const patch = sb._log.find((l) => l.table === "calls" && l.op === "update")!
    .data as Record<string, unknown>;
  assert.equal(patch["cost_status"], "partial");
  assert.ok((patch["cost_usd"] as number) > 0, "priced portion contributes");
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
