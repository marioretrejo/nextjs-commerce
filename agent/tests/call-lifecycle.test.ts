/**
 * Tests for CallLifecycleManager
 * Run with: pnpm tsx agent/tests/call-lifecycle.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CallLifecycleManager } from "../runtime/call-lifecycle.js";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Minimal Supabase stub ─────────────────────────────────────────────────────
function makeSupabaseStub(shouldFail = false) {
  const updates: Array<Record<string, unknown>> = [];
  const stub = {
    from: () => ({
      update: (patch: Record<string, unknown>) => {
        if (!shouldFail) updates.push(patch);
        return {
          eq: () =>
            shouldFail
              ? Promise.resolve({ error: { message: "db error" } })
              : Promise.resolve({ error: null }),
        };
      },
    }),
    _updates: updates,
  };
  return stub as unknown as SupabaseClient & { _updates: typeof updates };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test("initial status is initiated", () => {
  const sb = makeSupabaseStub();
  const lm = new CallLifecycleManager("room-1", "ws-1", sb);
  assert.equal(lm.status, "initiated");
  assert.equal(lm.outcome, null);
});

test("transitionTo updates status", async () => {
  const sb = makeSupabaseStub();
  const lm = new CallLifecycleManager("room-2", "ws-1", sb);
  await lm.transitionTo("in_progress");
  assert.equal(lm.status, "in_progress");
  assert.equal(sb._updates.length, 1);
  assert.equal(sb._updates[0]!.technical_status, "in_progress");
});

test("transitionTo to terminal status stamps ended_at", async () => {
  const sb = makeSupabaseStub();
  const lm = new CallLifecycleManager("room-3", "ws-1", sb);
  await lm.transitionTo("completed");
  assert.ok(lm.endedAt instanceof Date);
});

test("markAnswered transitions ringing → in_progress and stamps answeredAt", async () => {
  const sb = makeSupabaseStub();
  const lm = new CallLifecycleManager("room-4", "ws-1", sb);
  await lm.transitionTo("ringing");
  lm.markAnswered();
  assert.equal(lm.status, "in_progress");
  assert.ok(lm.answeredAt instanceof Date);
});

test("markAnswered is idempotent", () => {
  const sb = makeSupabaseStub();
  const lm = new CallLifecycleManager("room-5", "ws-1", sb);
  lm.markAnswered();
  const first = lm.answeredAt;
  lm.markAnswered();
  assert.equal(lm.answeredAt, first); // same reference
});

test("setOutcome sets outcome", () => {
  const sb = makeSupabaseStub();
  const lm = new CallLifecycleManager("room-6", "ws-1", sb);
  lm.setOutcome("voicemail");
  assert.equal(lm.outcome, "voicemail");
});

test("finalize: voicemail detected → outcome = voicemail", async () => {
  const sb = makeSupabaseStub();
  const lm = new CallLifecycleManager("room-7", "ws-1", sb);
  await lm.finalize({ voicemailDetected: true, durationSeconds: 4 });
  assert.equal(lm.outcome, "voicemail");
  assert.equal(lm.status, "no_answer");
});

test("finalize: explicit outcome is not overridden", async () => {
  const sb = makeSupabaseStub();
  const lm = new CallLifecycleManager("room-8", "ws-1", sb);
  lm.setOutcome("dnc");
  await lm.finalize({ voicemailDetected: false, durationSeconds: 10 });
  assert.equal(lm.outcome, "dnc");
});

test("finalize: normal completed call → outcome = contacted", async () => {
  const sb = makeSupabaseStub();
  const lm = new CallLifecycleManager("room-9", "ws-1", sb);
  await lm.transitionTo("in_progress");
  await lm.finalize({ voicemailDetected: false, durationSeconds: 30 });
  assert.equal(lm.outcome, "contacted");
  assert.equal(lm.status, "completed");
});

test("finalize is idempotent — second call is a no-op", async () => {
  const sb = makeSupabaseStub();
  const lm = new CallLifecycleManager("room-10", "ws-1", sb);
  await lm.finalize({ voicemailDetected: false, durationSeconds: 10 });
  const updatesBefore = sb._updates.length;
  await lm.finalize({ voicemailDetected: false, durationSeconds: 10 });
  assert.equal(sb._updates.length, updatesBefore); // no new writes
});

test("finalize respects already-terminal status (no_answer stays no_answer)", async () => {
  const sb = makeSupabaseStub();
  const lm = new CallLifecycleManager("room-11", "ws-1", sb);
  await lm.transitionTo("no_answer", "voicemail_detected");
  await lm.finalize({ voicemailDetected: true, durationSeconds: 5 });
  assert.equal(lm.status, "no_answer");
});

test("persist failure is swallowed — no throw", async () => {
  const sb = makeSupabaseStub(true); // Supabase returns error
  const lm = new CallLifecycleManager("room-12", "ws-1", sb);
  // Should not throw even though Supabase fails
  await assert.doesNotReject(() => lm.transitionTo("completed"));
});

test("transitionTo sets end_reason", async () => {
  const sb = makeSupabaseStub();
  const lm = new CallLifecycleManager("room-13", "ws-1", sb);
  await lm.transitionTo("cancelled", "dnc_detected");
  assert.equal(lm.endReason, "dnc_detected");
});

// Run summary
console.log("✓ call-lifecycle tests complete");
