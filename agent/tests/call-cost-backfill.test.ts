/**
 * Tests for call_cost_events call_id backfill
 *
 * After the close handler upserts a calls row, any call_cost_events recorded
 * before the row existed (call_id = null) must be updated with the real call_id.
 * BillingTracker.backfillCallId() handles this.
 *
 * Run with: pnpm tsx agent/tests/call-cost-backfill.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BillingTracker } from "../persistence/billing-tracker.js";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Minimal stub simulating the backfill path ─────────────────────────────────

interface CostEventRow {
  id: string;
  call_room: string;
  workspace_id: string;
  call_id: string | null;
  cost_type: string;
}

function makeBackfillStub(initialEvents: CostEventRow[]) {
  const events = [...initialEvents];
  const updateLog: Array<{
    call_id: string;
    call_room: string;
    workspace_id: string;
  }> = [];

  const stub = {
    from: (table: string) => {
      if (table === "call_cost_events") {
        return {
          // Used by backfillCallId
          update: (patch: { call_id: string }) => ({
            eq: (col1: string, v1: string) => ({
              eq: (col2: string, v2: string) => ({
                is: (_col: string, _val: null) => {
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
  } as unknown as SupabaseClient & {
    _events: CostEventRow[];
    _updateLog: typeof updateLog;
  };

  return stub;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("backfillCallId: sets call_id on events with null call_id", async () => {
  const events: CostEventRow[] = [
    {
      id: "e1",
      call_room: "room-1",
      workspace_id: "ws-1",
      call_id: null,
      cost_type: "telephony",
    },
    {
      id: "e2",
      call_room: "room-1",
      workspace_id: "ws-1",
      call_id: null,
      cost_type: "stt",
    },
  ];

  const stub = makeBackfillStub(events);
  const bt = new BillingTracker("room-1", "ws-1");
  await bt.backfillCallId("call-uuid-abc", stub);

  for (const ev of stub._events) {
    assert.equal(ev.call_id, "call-uuid-abc");
  }
});

test("backfillCallId: does not affect events from a different room", async () => {
  const events: CostEventRow[] = [
    {
      id: "e1",
      call_room: "room-1",
      workspace_id: "ws-1",
      call_id: null,
      cost_type: "telephony",
    },
    {
      id: "e2",
      call_room: "room-other",
      workspace_id: "ws-1",
      call_id: null,
      cost_type: "telephony",
    },
  ];

  const stub = makeBackfillStub(events);
  const bt = new BillingTracker("room-1", "ws-1");
  await bt.backfillCallId("call-uuid-xyz", stub);

  const other = stub._events.find((e) => e.call_room === "room-other")!;
  assert.equal(other.call_id, null, "other room events must not be touched");
});

test("backfillCallId: does not overwrite already-set call_id", async () => {
  const events: CostEventRow[] = [
    {
      id: "e1",
      call_room: "room-1",
      workspace_id: "ws-1",
      call_id: "existing-id",
      cost_type: "telephony",
    },
  ];

  const stub = makeBackfillStub(events);
  const bt = new BillingTracker("room-1", "ws-1");
  await bt.backfillCallId("new-call-id", stub);

  // Stub filters with .is("call_id", null) so pre-existing IDs are untouched
  assert.equal(stub._events[0]!.call_id, "existing-id");
});

test("backfillCallId: swallows errors without throwing", async () => {
  const badStub = {
    from: () => {
      throw new Error("network failure");
    },
  } as unknown as SupabaseClient;

  const bt = new BillingTracker("room-crash", "ws-1");
  await assert.doesNotReject(() => bt.backfillCallId("call-id", badStub));
});

console.log("✓ call-cost-backfill tests complete");
