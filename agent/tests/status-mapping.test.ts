/**
 * Tests for call status/outcome lifecycle mapping
 *
 * Verifies that technical_status + business_outcome combinations map to
 * the correct legacy status value and UI-visible label.
 *
 * Run with: pnpm tsx agent/tests/status-mapping.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CallLifecycleManager } from "../runtime/call-lifecycle.js";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Status mapping table (ground truth) ─────────────────────────────────────
//
// technical_status  | business_outcome   | legacy status  | UI label
// ──────────────────┼────────────────────┼────────────────┼──────────────────
// completed         | contacted          | completed      | Completed
// completed         | interested         | completed      | Completed
// completed         | not_interested     | completed      | Completed
// completed         | transferred        | completed      | Transferred
// completed         | silence_timeout    | completed      | Completed
// no_answer         | voicemail          | no_answer      | Voicemail
// cancelled         | dnc                | cancelled      | (DNC — filtered)
// failed            | error              | failed         | Failed
// no_answer         | (null)             | no_answer      | No Answer
// in_progress       | (null)             | in-progress    | (live)
// initiated         | (null)             | initiated      | (live)

// Legacy status values expected per technical_status:
const LEGACY_MAP: Record<string, string> = {
  initiated: "initiated",
  ringing: "ringing",
  in_progress: "in-progress",
  completed: "completed",
  failed: "failed",
  no_answer: "no_answer",
  busy: "failed", // busy maps to failed for backwards compat
  cancelled: "cancelled",
};

function makeStub() {
  const patches: Array<Record<string, unknown>> = [];
  const stub = {
    from: () => ({
      update: (p: Record<string, unknown>) => {
        patches.push(p);
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
    _patches: patches,
  } as unknown as SupabaseClient & { _patches: typeof patches };
  return stub;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("voicemail call: technical=no_answer, outcome=voicemail, legacy=no_answer", async () => {
  const sb = makeStub();
  const lm = new CallLifecycleManager("room-vm", "ws-1", sb);
  await lm.finalize({ voicemailDetected: true, durationSeconds: 4 });

  assert.equal(lm.status, "no_answer");
  assert.equal(lm.outcome, "voicemail");
  const patch = sb._patches[0]!;
  assert.equal(patch.technical_status, "no_answer");
  assert.equal(patch.status, LEGACY_MAP["no_answer"]);
  assert.equal(patch.business_outcome, "voicemail");
});

test("dnc call: technical=cancelled, outcome=dnc, legacy=cancelled", async () => {
  const sb = makeStub();
  const lm = new CallLifecycleManager("room-dnc", "ws-1", sb);
  lm.setOutcome("dnc");
  await lm.transitionTo("cancelled", "dnc_detected");

  assert.equal(lm.status, "cancelled");
  assert.equal(lm.outcome, "dnc");
  assert.equal(lm.endReason, "dnc_detected");
  const patch = sb._patches[0]!;
  assert.equal(patch.technical_status, "cancelled");
  assert.equal(patch.status, LEGACY_MAP["cancelled"]);
});

test("silence_timeout: technical=completed, outcome=silence_timeout, legacy=completed", async () => {
  const sb = makeStub();
  const lm = new CallLifecycleManager("room-st", "ws-1", sb);
  lm.setOutcome("silence_timeout");
  await lm.transitionTo("completed", "silence_timeout");

  assert.equal(lm.status, "completed");
  assert.equal(lm.outcome, "silence_timeout");
  const patch = sb._patches[0]!;
  assert.equal(patch.status, LEGACY_MAP["completed"]);
});

test("transferred: technical=completed, outcome=transferred, legacy=completed", async () => {
  const sb = makeStub();
  const lm = new CallLifecycleManager("room-tx", "ws-1", sb);
  lm.setOutcome("transferred");
  await lm.finalize({ voicemailDetected: false, durationSeconds: 45 });

  assert.equal(lm.status, "completed");
  assert.equal(lm.outcome, "transferred");
  const patch = sb._patches[0]!;
  assert.equal(patch.status, LEGACY_MAP["completed"]);
  // Ensure voicemail does NOT override explicit outcome
  assert.equal(patch.business_outcome, "transferred");
});

test("provider error: technical=failed, outcome=error, legacy=failed", async () => {
  const sb = makeStub();
  const lm = new CallLifecycleManager("room-err", "ws-1", sb);
  lm.setOutcome("error");
  await lm.transitionTo("failed", "provider_error");

  const patch = sb._patches[0]!;
  assert.equal(patch.technical_status, "failed");
  assert.equal(patch.status, LEGACY_MAP["failed"]);
});

test("busy (carrier): technical=busy maps to legacy=failed", async () => {
  const sb = makeStub();
  const lm = new CallLifecycleManager("room-busy", "ws-1", sb);
  await lm.transitionTo("busy", "carrier_busy");

  const patch = sb._patches[0]!;
  assert.equal(patch.technical_status, "busy");
  assert.equal(patch.status, LEGACY_MAP["busy"]); // "failed"
});

test("normal completed call: technical=completed, outcome=contacted, legacy=completed", async () => {
  const sb = makeStub();
  const lm = new CallLifecycleManager("room-ok", "ws-1", sb);
  lm.markAnswered();
  await lm.finalize({ voicemailDetected: false, durationSeconds: 120 });

  assert.equal(lm.status, "completed");
  assert.equal(lm.outcome, "contacted");
  // markAnswered() writes patch[0] (in_progress), finalize() writes the last patch (completed)
  const finalPatch = sb._patches[sb._patches.length - 1]!;
  assert.equal(finalPatch.status, LEGACY_MAP["completed"]);
  // answered_at is written from markAnswered path (present in finalPatch since _persist re-includes all set fields)
  assert.ok(finalPatch.answered_at, "answered_at should be set in final patch");
});

test("in-progress call: legacy status is 'in-progress' (dash, not underscore)", async () => {
  const sb = makeStub();
  const lm = new CallLifecycleManager("room-ip", "ws-1", sb);
  await lm.transitionTo("in_progress");

  const patch = sb._patches[0]!;
  assert.equal(patch.status, "in-progress");
});

test("voicemail does not override explicitly-set outcome", async () => {
  const sb = makeStub();
  const lm = new CallLifecycleManager("room-noov", "ws-1", sb);
  lm.setOutcome("interested");
  await lm.finalize({ voicemailDetected: true, durationSeconds: 30 });

  // Even though voicemail was detected, outcome was explicitly set to 'interested'
  assert.equal(lm.outcome, "interested");
});

console.log("✓ status-mapping tests complete");
