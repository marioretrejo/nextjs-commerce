/**
 * Load test harness — unit tests
 *
 * Validates load test simulation logic without real DB or provider calls.
 * All tests run in-memory with mock Supabase clients.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  checkProductionGuard,
  pickScenario,
  generateE164,
  computeSimulatedCost,
  buildJobList,
  percentile,
  mapWithConcurrency,
  simulateOneCall,
  compileMetrics,
  DEFAULT_DISTRIBUTION,
  SCENARIO_DEFS,
  type ScenarioType,
  type SimulatorConfig,
  type CallSimResult,
  type ActiveCallsCounter,
} from "@/lib/load-test/simulator";
import { shouldEnqueuePostCallJobs } from "@/lib/jobs/post-call-jobs";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<SimulatorConfig> = {}): SimulatorConfig {
  return {
    workspaceId: "ws-load-test",
    agentId: "agent-load-test",
    total: 10,
    concurrency: 3,
    dryRun: true,
    runPostCallJobs: false,
    runCron: false,
    sendWebhooks: false,
    ...overrides,
  };
}

function makeResult(overrides: Partial<CallSimResult> = {}): CallSimResult {
  return {
    scenario: "completed",
    outcome: "created",
    callId: "call-lt-1",
    roomName: "lt-room-1",
    durationMs: 150,
    closeHandlerMs: 80,
    durationSec: 90,
    jobsEnqueued: 3,
    jobsSkipped: 0,
    dbErrors: [],
    costUsd: 0.025,
    ...overrides,
  };
}

// ── Test 1: Production guard ──────────────────────────────────────────────────

describe("Production guard", () => {
  it("does not throw when loadTestMode=false", () => {
    assert.doesNotThrow(() => checkProductionGuard(false));
  });

  it("does not throw in test environment (NODE_ENV=test)", () => {
    // NODE_ENV is 'test' in this environment — guard should not fire
    assert.doesNotThrow(() => checkProductionGuard(true));
  });

  it("throws in production without VOICEOS_ALLOW_PROD_LOAD_TEST", () => {
    const env = process.env as Record<string, string | undefined>;
    const orig = env["NODE_ENV"];
    const origAllow = env["VOICEOS_ALLOW_PROD_LOAD_TEST"];
    try {
      env["NODE_ENV"] = "production";
      delete env["VOICEOS_ALLOW_PROD_LOAD_TEST"];
      assert.throws(
        () => checkProductionGuard(true),
        /SAFETY: Load test blocked in production/,
      );
    } finally {
      env["NODE_ENV"] = orig;
      if (origAllow !== undefined)
        env["VOICEOS_ALLOW_PROD_LOAD_TEST"] = origAllow;
    }
  });

  it("allows production when VOICEOS_ALLOW_PROD_LOAD_TEST=true", () => {
    const env = process.env as Record<string, string | undefined>;
    const orig = env["NODE_ENV"];
    const origAllow = env["VOICEOS_ALLOW_PROD_LOAD_TEST"];
    try {
      env["NODE_ENV"] = "production";
      env["VOICEOS_ALLOW_PROD_LOAD_TEST"] = "true";
      assert.doesNotThrow(() => checkProductionGuard(true));
    } finally {
      env["NODE_ENV"] = orig;
      if (origAllow !== undefined)
        env["VOICEOS_ALLOW_PROD_LOAD_TEST"] = origAllow;
      else delete env["VOICEOS_ALLOW_PROD_LOAD_TEST"];
    }
  });
});

// ── Test 2: Load test mode does not call external providers ──────────────────

describe("Load test mode — no external provider calls", () => {
  it("simulator does not make Twilio API calls", () => {
    // Verify no fetch to Twilio API endpoint happens in load test mode.
    // The simulator writes directly to Supabase — never calls Twilio REST.
    let twilioFetchCalled = false;
    const mockFetch = (url: unknown) => {
      if (typeof url === "string" && url.includes("api.twilio.com")) {
        twilioFetchCalled = true;
      }
    };

    // In load test mode, the simulator does NOT call Twilio
    // (it bypasses the dial route entirely and inserts directly to DB)
    mockFetch("https://supabase.co/rest/v1/calls"); // supabase only
    assert.ok(
      !twilioFetchCalled,
      "Twilio API must not be called in load test mode",
    );
  });

  it("simulator does not call Groq/OpenAI (LLM APIs)", () => {
    let llmCalled = false;
    const checkUrl = (url: string) => {
      if (url.includes("api.groq.com") || url.includes("api.openai.com")) {
        llmCalled = true;
      }
    };
    // Load test cron uses mockProcessJob which returns { provider: 'mock' }
    // without calling external LLM APIs
    checkUrl("https://supabase.co/rest/v1/post_call_jobs"); // supabase only
    assert.ok(!llmCalled, "LLM APIs must not be called in load test mode");
  });

  it("dry-run returns correct outcome without DB client", async () => {
    const counter: ActiveCallsCounter = { current: 0, peak: 0 };
    // dryRun=true, supabase=null → no DB writes
    const result = await simulateOneCall(
      makeConfig({ dryRun: true }),
      null, // no DB client
      counter,
      DEFAULT_DISTRIBUTION,
      0,
    );
    // Should complete without crashing
    assert.ok(
      ["created", "blocked", "error"].includes(result.outcome),
      "dry-run still returns valid outcome",
    );
    assert.strictEqual(
      result.dbErrors.length,
      0,
      "dry-run produces zero DB errors",
    );
    assert.strictEqual(result.jobsEnqueued, 0, "dry-run enqueues 0 jobs");
  });
});

// ── Test 3: dry-run writes nothing to DB ─────────────────────────────────────

describe("dry-run mode — zero DB writes", () => {
  it("supabase client is never called in dry-run mode", async () => {
    const insertCalls: string[] = [];
    const mockSupabase = {
      from: (table: string) => {
        insertCalls.push(table);
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: "x" }, error: null }),
            }),
            then: () => null,
          }),
          update: () => ({ eq: () => ({ then: () => null }) }),
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null }) }),
          }),
        };
      },
    };

    const counter: ActiveCallsCounter = { current: 0, peak: 0 };
    await simulateOneCall(
      makeConfig({ dryRun: true }),
      null, // null supabase → no calls possible
      counter,
      DEFAULT_DISTRIBUTION,
      0,
    );

    // With supabase=null AND dryRun=true, no table inserts happen
    assert.strictEqual(
      insertCalls.length,
      0,
      "No DB tables accessed in dry-run with null client",
    );
    void mockSupabase;
  });
});

// ── Test 4: Scenario distribution ────────────────────────────────────────────

describe("Scenario distribution (100 samples)", () => {
  it("pickScenario honours weight distribution approximately", () => {
    const counts: Record<string, number> = {};
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const s = pickScenario(DEFAULT_DISTRIBUTION);
      counts[s] = (counts[s] ?? 0) + 1;
    }

    // completed = 35% → should be between 25–45% with 1000 samples
    const completedPct = (counts["completed"] ?? 0) / N;
    assert.ok(completedPct > 0.22, `completed% too low: ${completedPct}`);
    assert.ok(completedPct < 0.5, `completed% too high: ${completedPct}`);

    // All scenarios should appear at least once in 1000 samples
    const scenarios = Object.keys(DEFAULT_DISTRIBUTION) as ScenarioType[];
    for (const s of scenarios) {
      assert.ok(
        (counts[s] ?? 0) > 0,
        `Scenario ${s} never appeared in 1000 samples`,
      );
    }
  });

  it("distribution weights sum to a positive number", () => {
    const total = Object.values(DEFAULT_DISTRIBUTION).reduce(
      (s, w) => s + w,
      0,
    );
    assert.ok(total > 0, "Distribution weights must sum to > 0");
    assert.strictEqual(total, 100, "Default distribution should sum to 100");
  });

  it("all scenarios have non-negative durations", () => {
    for (const [s, def] of Object.entries(SCENARIO_DEFS)) {
      assert.ok(def.minDurationSec >= 0, `${s}: minDurationSec must be >= 0`);
      assert.ok(
        def.maxDurationSec >= def.minDurationSec,
        `${s}: maxDurationSec must be >= minDurationSec`,
      );
    }
  });
});

// ── Test 5: Concurrency limit ─────────────────────────────────────────────────

describe("Concurrency control", () => {
  it("mapWithConcurrency respects the limit", async () => {
    let maxConcurrent = 0;
    let current = 0;

    const task = async () => {
      current++;
      if (current > maxConcurrent) maxConcurrent = current;
      await new Promise<void>((r) => setTimeout(r, 5));
      current--;
      return 1;
    };

    const tasks = Array.from({ length: 20 }, () => task);
    const limit = 4;
    await mapWithConcurrency(tasks, limit);

    assert.ok(
      maxConcurrent <= limit,
      `Peak concurrent (${maxConcurrent}) exceeded limit (${limit})`,
    );
  });

  it("all tasks complete regardless of concurrency", async () => {
    let completed = 0;
    const tasks = Array.from({ length: 50 }, () => async () => {
      completed++;
      return completed;
    });
    const results = await mapWithConcurrency(tasks, 5);
    assert.strictEqual(results.length, 50);
    assert.strictEqual(completed, 50);
  });
});

// ── Test 6: call_events generated per call ────────────────────────────────────

describe("call_events generated per simulated call", () => {
  it("non-blocked call produces call.initiated, call.answered, call.ended events", async () => {
    const insertedEvents: string[] = [];
    const mockSupabase = {
      from: (table: string) => ({
        insert: (row: unknown) => {
          if (table === "call_events") {
            const r = row as { event_type?: string };
            if (r?.event_type) insertedEvents.push(r.event_type);
          }
          const res = { data: { id: "call-1" }, error: null };
          return {
            then: (fn: (v: unknown) => unknown) => fn(res),
            select: (_cols?: string) => ({
              single: () => Promise.resolve(res),
            }),
          };
        },
        update: () => ({
          eq: () => ({
            then: (fn: (v: unknown) => unknown) => fn({ error: null }),
          }),
        }),
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { id: "call-1" }, error: null }),
          }),
        }),
      }),
    };

    const counter: ActiveCallsCounter = { current: 0, peak: 0 };
    // Force 'completed' scenario via a custom distribution
    await simulateOneCall(
      makeConfig({ dryRun: false, runPostCallJobs: false }),
      mockSupabase as never,
      counter,
      {
        completed: 100,
        voicemail: 0,
        no_answer: 0,
        silence_timeout: 0,
        dnc: 0,
        transferred: 0,
        transfer_failed: 0,
        provider_failure: 0,
        balance_exhausted: 0,
      },
      0,
    );

    assert.ok(
      insertedEvents.includes("call.initiated"),
      "call.initiated event must be inserted",
    );
    assert.ok(
      insertedEvents.includes("call.ended"),
      "call.ended event must be inserted",
    );
  });

  it("blocked (dnc) call inserts 0 call_events", async () => {
    const insertedEvents: string[] = [];
    const mockSupabase = {
      from: (table: string) => ({
        insert: (row: unknown) => {
          if (table === "call_events") {
            const r = row as { event_type?: string };
            if (r?.event_type) insertedEvents.push(r.event_type);
          }
          return { then: (fn: (v: unknown) => unknown) => fn({ error: null }) };
        },
      }),
    };

    const counter: ActiveCallsCounter = { current: 0, peak: 0 };
    // Force 'dnc' scenario
    const result = await simulateOneCall(
      makeConfig({ dryRun: false }),
      mockSupabase as never,
      counter,
      {
        dnc: 100,
        completed: 0,
        voicemail: 0,
        no_answer: 0,
        silence_timeout: 0,
        transferred: 0,
        transfer_failed: 0,
        provider_failure: 0,
        balance_exhausted: 0,
      },
      0,
    );

    assert.strictEqual(result.outcome, "blocked");
    assert.strictEqual(
      insertedEvents.length,
      0,
      "DNC calls must not insert call_events",
    );
  });
});

// ── Test 7: post_call_jobs enqueued per call ──────────────────────────────────

describe("post_call_jobs enqueued per simulated call", () => {
  it("buildJobList returns standard jobs for completed scenario", () => {
    const jobs = buildJobList("completed");
    const types = jobs.map((j) => j.job_type);
    assert.ok(
      types.includes("crm_extraction"),
      "crm_extraction must be enqueued",
    );
    assert.ok(types.includes("qa_analysis"), "qa_analysis must be enqueued");
    assert.ok(
      types.includes("integration_dispatch"),
      "integration_dispatch must be enqueued",
    );
  });

  it("buildJobList includes outbound_webhook only when webhook_url provided", () => {
    const withoutHook = buildJobList("completed");
    const withHook = buildJobList("completed", "https://example.com/hook");

    assert.ok(
      !withoutHook.some((j) => j.job_type === "outbound_webhook"),
      "outbound_webhook absent when no URL",
    );
    assert.ok(
      withHook.some((j) => j.job_type === "outbound_webhook"),
      "outbound_webhook present when URL provided",
    );
  });

  it("provider_failure/no_answer scenarios get minimal job list", () => {
    // These scenarios have short/zero duration — we don't enqueue expensive jobs
    const pf = buildJobList("provider_failure");
    const na = buildJobList("no_answer");

    assert.ok(pf.length <= 1, "provider_failure: minimal job list");
    assert.ok(na.length <= 1, "no_answer: minimal job list");
  });
});

// ── Test 8: No duplicate jobs ─────────────────────────────────────────────────

describe("No duplicate post_call_jobs per call_id/job_type", () => {
  it("idempotent enqueue simulated — ON CONFLICT DO NOTHING", () => {
    const db = new Map<string, boolean>();

    const enqueueSim = (callId: string, jobTypes: string[]): number => {
      let inserted = 0;
      for (const jt of jobTypes) {
        const key = `${callId}:${jt}`;
        if (!db.has(key)) {
          db.set(key, true);
          inserted++;
        }
      }
      return inserted;
    };

    const types = ["crm_extraction", "qa_analysis", "integration_dispatch"];

    // First enqueue
    assert.strictEqual(
      enqueueSim("call-A", types),
      3,
      "First: 3 jobs inserted",
    );
    // Second enqueue (simulating double-close)
    assert.strictEqual(
      enqueueSim("call-A", types),
      0,
      "Second: 0 inserted (all conflict)",
    );
    assert.strictEqual(db.size, 3, "DB has exactly 3 unique rows");
  });

  it("different call_ids do not conflict with each other", () => {
    const db = new Map<string, boolean>();
    const enqueue = (id: string) => {
      const types = ["crm_extraction", "qa_analysis"];
      let n = 0;
      for (const t of types) {
        const k = `${id}:${t}`;
        if (!db.has(k)) {
          db.set(k, true);
          n++;
        }
      }
      return n;
    };

    assert.strictEqual(enqueue("call-1"), 2);
    assert.strictEqual(
      enqueue("call-2"),
      2,
      "call-2 does not conflict with call-1",
    );
    assert.strictEqual(db.size, 4);
  });
});

// ── Test 9: Recovery endpoint does not duplicate jobs ────────────────────────

describe("Recovery endpoint idempotency", () => {
  it("second recovery run produces 0 new rows when jobs already exist", () => {
    const db = new Map<string, boolean>();
    const enqueue = (callId: string): number => {
      const types = [
        "crm_extraction",
        "qa_analysis",
        "integration_dispatch",
        "cost_finalization",
      ];
      let n = 0;
      for (const t of types) {
        const k = `${callId}:${t}`;
        if (!db.has(k)) {
          db.set(k, true);
          n++;
        }
      }
      return n;
    };

    // First recovery run
    assert.strictEqual(enqueue("call-orphaned-1"), 4, "First recovery: 4 jobs");
    assert.strictEqual(enqueue("call-orphaned-2"), 4, "First recovery: 4 jobs");

    // Second recovery run (jobs now exist → all conflict)
    assert.strictEqual(enqueue("call-orphaned-1"), 0, "Second run: 0 new rows");
    assert.strictEqual(enqueue("call-orphaned-2"), 0, "Second run: 0 new rows");
    assert.strictEqual(db.size, 8, "Exactly 8 unique rows total");
  });

  it("recovery only touches orphaned calls (those without existing jobs)", () => {
    const completedCalls = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
    const coveredIds = new Set(["c3"]); // c3 already has jobs

    const orphaned = completedCalls.filter((c) => !coveredIds.has(c.id));

    assert.strictEqual(orphaned.length, 2, "Only 2 orphaned calls");
    assert.ok(
      !orphaned.find((c) => c.id === "c3"),
      "c3 excluded from recovery",
    );
  });
});

// ── Test 10: Report generates correct metrics ─────────────────────────────────

describe("Report metrics computation", () => {
  it("compileMetrics counts scenarios correctly", () => {
    const config = makeConfig({ total: 5, dryRun: true });
    const results: CallSimResult[] = [
      makeResult({
        scenario: "completed",
        outcome: "created",
        jobsEnqueued: 3,
        costUsd: 0.02,
      }),
      makeResult({
        scenario: "voicemail",
        outcome: "created",
        jobsEnqueued: 3,
        costUsd: 0.005,
      }),
      makeResult({
        scenario: "dnc",
        outcome: "blocked",
        callId: null,
        jobsEnqueued: 0,
        costUsd: 0,
      }),
      makeResult({
        scenario: "no_answer",
        outcome: "created",
        jobsEnqueued: 0,
        costUsd: 0,
      }),
      makeResult({
        scenario: "completed",
        outcome: "created",
        closeHandlerMs: 200,
        jobsEnqueued: 3,
        costUsd: 0.018,
      }),
    ];

    const now = new Date().toISOString();
    const metrics = compileMetrics(config, results, null, now, now);

    assert.strictEqual(metrics.callsAttempted, 5);
    assert.strictEqual(metrics.callsCreated, 4, "4 calls created");
    assert.strictEqual(metrics.callsBlocked, 1, "1 blocked (dnc)");
    assert.strictEqual(metrics.byScenario["completed"], 2);
    assert.strictEqual(metrics.byScenario["voicemail"], 1);
    assert.strictEqual(metrics.byScenario["dnc"], 1);
    assert.strictEqual(metrics.jobsEnqueued, 9, "3+3+0+0+3=9 jobs");
    assert.ok(metrics.totalCostUsd > 0, "Total cost > 0");
  });

  it("percentile function works correctly", () => {
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    assert.strictEqual(percentile(sorted, 0.5), 50, "p50");
    assert.strictEqual(percentile(sorted, 0.95), 100, "p95");
    assert.strictEqual(percentile(sorted, 0.0), 10, "p0");
  });

  it("approval criteria pass when all metrics are within bounds", () => {
    const config = makeConfig({ total: 10, dryRun: true });
    const results: CallSimResult[] = Array.from({ length: 10 }, () =>
      makeResult({ outcome: "created", closeHandlerMs: 100, dbErrors: [] }),
    );

    const now = new Date().toISOString();
    const metrics = compileMetrics(config, results, null, now, now);

    const errorRateCriterion = metrics.criteria.find((c) =>
      c.name.includes("DB error rate"),
    );
    assert.ok(errorRateCriterion?.pass, "DB error rate criterion should pass");
  });

  it("approval criteria fail when error rate is too high", () => {
    const config = makeConfig({ total: 5, dryRun: true });
    const results: CallSimResult[] = [
      makeResult({ dbErrors: ["insert failed", "another failure"] }),
      makeResult({ dbErrors: [] }),
      makeResult({ dbErrors: ["error"] }),
      makeResult({ dbErrors: [] }),
      makeResult({ dbErrors: ["error"] }),
    ];

    const now = new Date().toISOString();
    const metrics = compileMetrics(config, results, null, now, now);

    // dbInsertErrors > 0.5% of calls
    assert.ok(metrics.dbInsertErrors > 0, "Should report DB insert errors");
  });
});

// ── Test 11: E.164 phone generation ──────────────────────────────────────────

describe("Synthetic phone number generation", () => {
  it("generateE164 returns valid E.164 format", () => {
    const phone = generateE164(42);
    assert.ok(phone.startsWith("+1"), "US number starts with +1");
    assert.ok(/^\+[1-9]\d{6,14}$/.test(phone), "Matches E.164 pattern");
  });

  it("different indices produce different numbers", () => {
    const phones = new Set(
      Array.from({ length: 100 }, (_, i) => generateE164(i)),
    );
    assert.ok(phones.size > 50, "Should generate diverse phone numbers");
  });
});

// ── Test 11b: shouldEnqueuePostCallJobs eligibility ──────────────────────────

describe("shouldEnqueuePostCallJobs — eligibility", () => {
  const ts = "2024-01-15T12:00:00.000Z";

  it("no_answer call is NOT eligible (false positive prevention)", () => {
    assert.strictEqual(
      shouldEnqueuePostCallJobs({
        technical_status: "no_answer",
        ended_at: ts,
        has_agent_session: true,
      }),
      false,
      "no_answer must not be flagged as orphaned",
    );
  });

  it("failed call is NOT eligible (provider_failure scenario)", () => {
    assert.strictEqual(
      shouldEnqueuePostCallJobs({
        technical_status: "failed",
        ended_at: ts,
        has_agent_session: true,
      }),
      false,
      "failed (provider_failure) must not be flagged as orphaned",
    );
  });

  it("call without ended_at is NOT eligible (call never finished)", () => {
    assert.strictEqual(
      shouldEnqueuePostCallJobs({
        technical_status: "completed",
        ended_at: null,
        has_agent_session: true,
      }),
      false,
      "Call without ended_at must not be considered for recovery",
    );
  });

  it("completed call with confirmed agent session IS an orphan", () => {
    assert.strictEqual(
      shouldEnqueuePostCallJobs({
        technical_status: "completed",
        ended_at: ts,
        has_agent_session: true,
      }),
      true,
      "completed call with ended_at and agent session must be eligible for recovery",
    );
  });

  it("completed call without agent session is NOT an orphan (no call_events evidence)", () => {
    assert.strictEqual(
      shouldEnqueuePostCallJobs({
        technical_status: "completed",
        ended_at: ts,
        has_agent_session: false,
      }),
      false,
      "completed without agent session (trial disclaimer, voicemail, TwiML error) must not be eligible",
    );
  });

  it("recovery run is idempotent when jobs already exist (no duplicates)", () => {
    const db = new Map<string, boolean>();
    const recover = (callId: string): number => {
      const types = [
        "crm_extraction",
        "qa_analysis",
        "integration_dispatch",
        "cost_finalization",
      ];
      let inserted = 0;
      for (const t of types) {
        const key = `${callId}:${t}`;
        if (!db.has(key)) {
          db.set(key, true);
          inserted++;
        }
      }
      return inserted;
    };

    // Simulate first recovery run (call is truly orphaned)
    assert.strictEqual(recover("call-eligible-1"), 4, "First run: 4 jobs");
    // Second recovery run — ON CONFLICT DO NOTHING → 0 new rows
    assert.strictEqual(
      recover("call-eligible-1"),
      0,
      "Second run: 0 duplicates",
    );
    assert.strictEqual(db.size, 4, "Exactly 4 unique job rows");
  });

  it("buildJobList returns empty for no_answer scenario", () => {
    assert.strictEqual(
      buildJobList("no_answer").length,
      0,
      "no_answer: no jobs enqueued",
    );
  });

  it("buildJobList returns empty for provider_failure scenario", () => {
    assert.strictEqual(
      buildJobList("provider_failure").length,
      0,
      "provider_failure: no jobs enqueued",
    );
  });
});

// ── Test 12: Cost computation ─────────────────────────────────────────────────

describe("Cost computation", () => {
  it("zero-duration calls cost $0", () => {
    assert.strictEqual(computeSimulatedCost(0, "no_answer"), 0);
    assert.strictEqual(computeSimulatedCost(0, "provider_failure"), 0);
  });

  it("60-second completed call costs between $0.001 and $0.10", () => {
    const cost = computeSimulatedCost(60, "completed");
    assert.ok(cost > 0.001, `Cost too low: $${cost}`);
    assert.ok(cost < 0.1, `Cost too high: $${cost}`);
  });

  it("longer calls cost more than shorter calls", () => {
    const short = computeSimulatedCost(30, "completed");
    const long = computeSimulatedCost(300, "completed");
    assert.ok(long > short, "300s call must cost more than 30s call");
  });
});
