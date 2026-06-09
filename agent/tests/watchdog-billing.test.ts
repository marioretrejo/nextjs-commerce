/**
 * Integration tests: Watchdog phases × BillingTracker TTS metering
 *
 * Simulates the three-phase watchdog scenarios (thinking + TTFB) and verifies
 * that TTS characters from watchdog filler phrases are:
 *  1. Correctly attributed to the manual_session_say bucket (via dedupe).
 *  2. Accumulated into the single consolidated TTS cost event.
 *  3. Not double-counted when ConversationItemAdded also fires for them.
 *
 * Run with: pnpm tsx agent/tests/watchdog-billing.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BillingTracker } from "../persistence/billing-tracker.js";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Supabase stub ─────────────────────────────────────────────────────────────

interface StubRow {
  table: string;
  op: "insert" | "update";
  data: Record<string, unknown> | Record<string, unknown>[];
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

// Phrase that thinking-watchdog phase-2 injects after 7 s of stall
const THINKING_FILLER = "Un momento…";

// ── Thinking Watchdog — Phase 2 ───────────────────────────────────────────────

test("thinking watchdog phase-2: filler counted in manual_session_say bucket", async () => {
  const sb = makeStub(COSTS);
  const bt = new BillingTracker("room-tw2", "ws-1");

  // Simulate: trackedSay(THINKING_FILLER) → billing.trackManualSay(THINKING_FILLER)
  bt.trackManualSay(THINKING_FILLER);
  // Simulate: ConversationItemAdded fires for the injected filler
  bt.trackPipelineTTS(THINKING_FILLER);

  // Verify accumulator state before persist
  const sb2 = makeStub(COSTS);
  await bt.computeAndPersist("call-tw2", sb2);

  const rows = sb2._log.find((l) => l.table === "call_cost_events")!
    .data as Record<string, unknown>[];
  const tts = rows.find((r) => r["cost_type"] === "tts")!;
  assert.equal(tts["quantity"], THINKING_FILLER.length);
  const meta = tts["metadata"] as Record<string, unknown>;
  const sources = meta["sources"] as Record<string, Record<string, number>>;
  assert.equal(
    sources["manual_session_say"]!["characters"],
    THINKING_FILLER.length,
    "filler in manual bucket",
  );
  assert.equal(
    sources["agent_pipeline_tts"]!["characters"],
    0,
    "pipeline bucket empty",
  );
  assert.equal(meta["tts_pipeline_visibility"], "manual_only");
});

test("thinking watchdog phase-2: _ttsCharsTotal increments by exact filler length", async () => {
  const bt = new BillingTracker("room-tw2b", "ws-1");
  bt.trackManualSay(THINKING_FILLER);
  bt.trackPipelineTTS(THINKING_FILLER); // consumed → manual

  // Accumulate a real LLM response too
  const llmResponse =
    "Lo siento, estaba procesando su solicitud. ¿En qué le puedo ayudar?";
  bt.trackPipelineTTS(llmResponse);

  const sb = makeStub(COSTS);
  await bt.computeAndPersist("call-tw2b", sb);

  const rows = sb._log.find((l) => l.table === "call_cost_events")!
    .data as Record<string, unknown>[];
  const tts = rows.find((r) => r["cost_type"] === "tts")!;

  assert.equal(
    tts["quantity"],
    THINKING_FILLER.length + llmResponse.length,
    "total = filler + LLM response",
  );
  const meta = tts["metadata"] as Record<string, unknown>;
  const sources = meta["sources"] as Record<string, Record<string, number>>;
  assert.equal(
    sources["manual_session_say"]!["characters"],
    THINKING_FILLER.length,
  );
  assert.equal(
    sources["agent_pipeline_tts"]!["characters"],
    llmResponse.length,
  );
});

test("thinking watchdog phase-2 fires twice: both fillers counted without duplication", async () => {
  const bt = new BillingTracker("room-tw2c", "ws-1");

  // Watchdog fires twice (two separate stalls during a long call)
  bt.trackManualSay(THINKING_FILLER);
  bt.trackPipelineTTS(THINKING_FILLER); // first ConversationItemAdded → count now 0
  bt.trackManualSay(THINKING_FILLER);
  bt.trackPipelineTTS(THINKING_FILLER); // second ConversationItemAdded → count now 0

  const sb = makeStub(COSTS);
  await bt.computeAndPersist("call-tw2c", sb);

  const rows = sb._log.find((l) => l.table === "call_cost_events")!
    .data as Record<string, unknown>[];
  const tts = rows.find((r) => r["cost_type"] === "tts")!;
  assert.equal(
    tts["quantity"],
    THINKING_FILLER.length * 2,
    "both fillers counted",
  );
  const meta = tts["metadata"] as Record<string, unknown>;
  const sources = meta["sources"] as Record<string, Record<string, number>>;
  assert.equal(sources["manual_session_say"]!["say_count"], 2);
  assert.equal(sources["agent_pipeline_tts"]!["message_count"], 0);
});

// ── TTFB Watchdog — Phase 2 ───────────────────────────────────────────────────

test("TTFB watchdog phase-2: currently a log-only event (no TTS injection) → no extra chars", async () => {
  // Phase 2 of TTFB watchdog at 2500ms logs but does NOT inject any audio.
  // This test verifies that the BillingTracker correctly records zero TTS chars
  // for a call where only the TTFB phase-2 fired (no speech from agent).
  const bt = new BillingTracker("room-ttfb2", "ws-1");
  // TTFB phase-2 fires — no trackedSay call, no ConversationItemAdded → nothing tracked

  const sb = makeStub(COSTS);
  await bt.computeAndPersist("call-ttfb2", sb);
  // No TTS usage → computeAndPersist inserts no rows
  const insertEntry = sb._log.find((l) => l.table === "call_cost_events");
  assert.equal(
    insertEntry,
    undefined,
    "TTFB phase-2 alone should not generate a TTS cost event",
  );
});

// ── Full watchdog scenario: latency + normal conversation ─────────────────────

test("slow call: thinking watchdog + normal LLM turns + farewell all accumulate correctly", async () => {
  const bt = new BillingTracker("room-slow", "ws-1");

  // Greeting (manual)
  const greeting = "Hello! Thank you for calling. How can I assist you today?";
  bt.trackManualSay(greeting);
  bt.trackPipelineTTS(greeting); // → manual

  // Normal LLM response turn 1
  const turn1 =
    "Of course! I can help you reset your password. May I have your email?";
  bt.trackPipelineTTS(turn1); // → pipeline

  // Thinking watchdog fires at 7s (LLM stall)
  bt.trackManualSay(THINKING_FILLER);
  bt.trackPipelineTTS(THINKING_FILLER); // → manual (deduped)

  // LLM eventually responds after stall
  const turn2 =
    "I've sent the reset link to your email. Please check your inbox.";
  bt.trackPipelineTTS(turn2); // → pipeline

  // Farewell (manual, from endCallTool)
  const farewell = "Thank you for calling! Have a great day. Goodbye!";
  bt.trackManualSay(farewell);
  bt.trackPipelineTTS(farewell); // → manual

  // Duration-based billing
  bt.trackTelephony(95, "inbound");
  bt.trackLiveKit(95);
  bt.trackSTT(95);
  bt.trackLLMTokens(
    Math.round(
      (greeting.length + turn1.length + turn2.length + farewell.length) / 3,
    ),
  );

  const sb = makeStub(COSTS);
  await bt.computeAndPersist("call-slow", sb);

  const rows = sb._log.find((l) => l.table === "call_cost_events")!
    .data as Record<string, unknown>[];

  // Exactly one TTS row
  const ttsRows = rows.filter((r) => r["cost_type"] === "tts");
  assert.equal(ttsRows.length, 1, "single TTS cost event");

  const tts = ttsRows[0]!;
  const expectedTotal =
    greeting.length +
    THINKING_FILLER.length +
    farewell.length +
    turn1.length +
    turn2.length;
  assert.equal(tts["quantity"], expectedTotal);

  const meta = tts["metadata"] as Record<string, unknown>;
  const sources = meta["sources"] as Record<string, Record<string, number>>;
  assert.equal(
    sources["manual_session_say"]!["characters"],
    greeting.length + THINKING_FILLER.length + farewell.length,
  );
  assert.equal(sources["manual_session_say"]!["say_count"], 3);
  assert.equal(
    sources["agent_pipeline_tts"]!["characters"],
    turn1.length + turn2.length,
  );
  assert.equal(sources["agent_pipeline_tts"]!["message_count"], 2);
  assert.equal(meta["tts_pipeline_visibility"], "captured");

  // All 5 cost types present
  const costTypes = rows.map((r) => r["cost_type"]);
  assert.ok(costTypes.includes("telephony"));
  assert.ok(costTypes.includes("livekit_media"));
  assert.ok(costTypes.includes("stt"));
  assert.ok(costTypes.includes("tts"));
  assert.ok(costTypes.includes("llm"));
});

console.log("✓ watchdog-billing tests complete");
