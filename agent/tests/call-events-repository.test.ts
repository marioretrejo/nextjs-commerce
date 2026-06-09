/**
 * Tests for call-events-repository
 * Run with: pnpm tsx agent/tests/call-events-repository.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  recordCallEvent,
  makeEventRecorder,
} from "../persistence/call-events-repository.js";
import type { SupabaseClient } from "@supabase/supabase-js";

function makeSupabaseStub(shouldFail = false) {
  const inserts: Array<Record<string, unknown>> = [];
  const stub = {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        if (!shouldFail) inserts.push(row);
        return Promise.resolve(
          shouldFail ? { error: { message: "db error" } } : { error: null },
        );
      },
    }),
    _inserts: inserts,
  };
  return stub as unknown as SupabaseClient & { _inserts: typeof inserts };
}

test("recordCallEvent inserts a row", async () => {
  const sb = makeSupabaseStub();
  await recordCallEvent(sb, "room-1", "ws-1", "call.initiated", {
    direction: "outbound",
  });
  assert.equal(sb._inserts.length, 1);
  assert.equal(sb._inserts[0]!.event_type, "call.initiated");
  assert.equal(sb._inserts[0]!.call_room, "room-1");
  assert.equal(sb._inserts[0]!.workspace_id, "ws-1");
  assert.deepEqual(sb._inserts[0]!.payload, { direction: "outbound" });
});

test("recordCallEvent defaults payload to empty object", async () => {
  const sb = makeSupabaseStub();
  await recordCallEvent(sb, "room-2", "ws-1", "call.ended");
  assert.deepEqual(sb._inserts[0]!.payload, {});
});

test("recordCallEvent swallows Supabase errors — never throws", async () => {
  const sb = makeSupabaseStub(true);
  await assert.doesNotReject(() =>
    recordCallEvent(sb, "room-3", "ws-1", "call.failed"),
  );
});

test("recordCallEvent swallows thrown exceptions — never throws", async () => {
  const badSb = {
    from: () => {
      throw new Error("unexpected crash");
    },
  } as unknown as SupabaseClient;
  await assert.doesNotReject(() =>
    recordCallEvent(badSb, "room-4", "ws-1", "call.ended"),
  );
});

test("makeEventRecorder returns a bound void function", () => {
  const sb = makeSupabaseStub();
  const emit = makeEventRecorder(sb, "room-5", "ws-1");
  assert.equal(typeof emit, "function");
  // Should not throw synchronously
  assert.doesNotThrow(() => emit("call.answered", { elapsed_ms: 1200 }));
});

test("makeEventRecorder records events with correct room/workspace", async () => {
  const sb = makeSupabaseStub();
  const emit = makeEventRecorder(sb, "my-room", "my-ws");
  emit("call.voicemail_detected");
  // Allow microtask queue to flush
  await new Promise((r) => setImmediate(r));
  assert.equal(sb._inserts[0]!.call_room, "my-room");
  assert.equal(sb._inserts[0]!.workspace_id, "my-ws");
});

console.log("✓ call-events-repository tests complete");
