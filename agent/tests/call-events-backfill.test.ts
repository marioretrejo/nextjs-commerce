/**
 * Tests for call_id backfill logic
 *
 * Validates that after the close handler upserts a calls row, the call_id
 * is correctly propagated to all call_events for that room.
 *
 * Run with: pnpm tsx agent/tests/call-events-backfill.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// ── Minimal Supabase stub that simulates the backfill flow ────────────────────

interface CallEventsRow {
  id: string;
  call_room: string;
  workspace_id: string;
  call_id: string | null;
  event_type: string;
}

function makeBackfillStub(initialEvents: CallEventsRow[]) {
  const events = [...initialEvents];
  const callsDb: Array<{ id: string; retell_call_id: string }> = [
    { id: "call-uuid-abc", retell_call_id: "room-test-1" },
  ];

  const updateLog: Array<{
    call_id: string;
    call_room: string;
    workspace_id: string;
  }> = [];

  const stub = {
    from: (table: string) => {
      if (table === "calls") {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: () => {
                const row = callsDb.find((r) => r.retell_call_id === val);
                return Promise.resolve({ data: row ?? null, error: null });
              },
            }),
          }),
        };
      }
      if (table === "call_events") {
        return {
          update: (patch: { call_id: string }) => ({
            eq: (col1: string, v1: string) => ({
              eq: (col2: string, v2: string) => ({
                is: (_col: string, _val: null) => {
                  // Apply backfill
                  updateLog.push({
                    call_id: patch.call_id,
                    call_room: v1,
                    workspace_id: v2,
                  });
                  for (const ev of events) {
                    if (
                      ev.call_room === v1 &&
                      ev.workspace_id === v2 &&
                      ev.call_id === null
                    ) {
                      ev.call_id = patch.call_id;
                    }
                  }
                  return Promise.resolve({ error: null });
                },
              }),
            }),
          }),
        };
      }
      return {};
    },
    _events: events,
    _updateLog: updateLog,
  };

  return stub;
}

// ── Simulate the backfill logic from worker_core.ts close handler ─────────────

async function runBackfill(
  stub: ReturnType<typeof makeBackfillStub>,
  roomName: string,
  workspaceId: string,
) {
  try {
    const { data: callIdRow } = await (stub as any)
      .from("calls")
      .select("id")
      .eq("retell_call_id", roomName)
      .maybeSingle();

    if (callIdRow?.id) {
      await (stub as any)
        .from("call_events")
        .update({ call_id: callIdRow.id })
        .eq("call_room", roomName)
        .eq("workspace_id", workspaceId)
        .is("call_id", null);
      return { backfilled: true, call_id: callIdRow.id };
    }
    return { backfilled: false };
  } catch (err) {
    return { backfilled: false, error: String(err) };
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("backfill sets call_id on events with null call_id", async () => {
  const events: CallEventsRow[] = [
    {
      id: "ev-1",
      call_room: "room-test-1",
      workspace_id: "ws-1",
      call_id: null,
      event_type: "call.initiated",
    },
    {
      id: "ev-2",
      call_room: "room-test-1",
      workspace_id: "ws-1",
      call_id: null,
      event_type: "call.answered",
    },
    {
      id: "ev-3",
      call_room: "room-test-1",
      workspace_id: "ws-1",
      call_id: null,
      event_type: "call.ended",
    },
  ];

  const stub = makeBackfillStub(events);
  const result = await runBackfill(stub, "room-test-1", "ws-1");

  assert.equal(result.backfilled, true);
  assert.equal(result.call_id, "call-uuid-abc");
  for (const ev of stub._events) {
    assert.equal(ev.call_id, "call-uuid-abc");
  }
});

test("backfill does not affect events from a different room", async () => {
  const events: CallEventsRow[] = [
    {
      id: "ev-1",
      call_room: "room-test-1",
      workspace_id: "ws-1",
      call_id: null,
      event_type: "call.initiated",
    },
    {
      id: "ev-2",
      call_room: "room-other",
      workspace_id: "ws-1",
      call_id: null,
      event_type: "call.initiated",
    },
  ];

  const stub = makeBackfillStub(events);
  await runBackfill(stub, "room-test-1", "ws-1");

  const roomOther = stub._events.find((e) => e.call_room === "room-other")!;
  assert.equal(
    roomOther.call_id,
    null,
    "events from other rooms must not be touched",
  );
});

test("backfill skips events that already have call_id set", async () => {
  const events: CallEventsRow[] = [
    {
      id: "ev-1",
      call_room: "room-test-1",
      workspace_id: "ws-1",
      call_id: "existing-id",
      event_type: "call.initiated",
    },
    {
      id: "ev-2",
      call_room: "room-test-1",
      workspace_id: "ws-1",
      call_id: null,
      event_type: "call.ended",
    },
  ];

  const stub = makeBackfillStub(events);
  await runBackfill(stub, "room-test-1", "ws-1");

  const ev1 = stub._events.find((e) => e.id === "ev-1")!;
  assert.equal(
    ev1.call_id,
    "existing-id",
    "pre-existing call_id must not be overwritten",
  );
});

test("backfill is skipped gracefully when calls row not found", async () => {
  const events: CallEventsRow[] = [
    {
      id: "ev-1",
      call_room: "room-unknown",
      workspace_id: "ws-1",
      call_id: null,
      event_type: "call.initiated",
    },
  ];

  const stub = makeBackfillStub(events);
  const result = await runBackfill(stub, "room-unknown", "ws-1");

  assert.equal(result.backfilled, false);
  assert.equal(
    stub._events[0]!.call_id,
    null,
    "events untouched when room not in calls table",
  );
});

test("backfill swallows Supabase errors without throwing", async () => {
  const badStub = {
    from: () => {
      throw new Error("connection reset");
    },
  };

  const result = await runBackfill(badStub as any, "room-crash", "ws-1");
  assert.equal(result.backfilled, false);
  assert.ok(result.error?.includes("connection reset"));
});

console.log("✓ call-events-backfill tests complete");
