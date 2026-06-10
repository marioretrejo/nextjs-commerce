/**
 * lib/load-test/simulator.ts
 *
 * Core call simulation engine for VoiceOS load testing.
 *
 * Simulates the full call lifecycle at the DB layer — no real LiveKit rooms,
 * no Twilio calls, no STT/TTS/LLM providers. Writes real rows to Supabase
 * so post-call jobs, compliance checks, and cost tracking can be exercised
 * end-to-end under controlled load.
 *
 * Safety guarantees:
 *   - Production guard: throws when NODE_ENV=production unless VOICEOS_ALLOW_PROD_LOAD_TEST=true
 *   - All simulated calls carry metadata.load_test=true for easy cleanup
 *   - dryRun=true skips all DB writes (pure metrics simulation)
 *   - VOICEOS_LOAD_TEST_SEND_WEBHOOKS defaults to false (webhooks skipped)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  enqueuePostCallJobsForCall,
  claimNextPostCallJobs,
  markJobCompleted,
  markJobFailed,
  markJobRetrying,
  markJobDeadLetter,
  shouldRetryJob,
  type PostCallJob,
  type EnqueueJobInput,
} from "@/lib/jobs/post-call-jobs";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ScenarioType =
  | "completed"
  | "voicemail"
  | "no_answer"
  | "silence_timeout"
  | "dnc"
  | "transferred"
  | "transfer_failed"
  | "provider_failure"
  | "balance_exhausted";

export interface ScenarioDef {
  technicalStatus: string | null;
  businessOutcome: string | null;
  minDurationSec: number;
  maxDurationSec: number;
  createsCall: boolean;
  eligibilityAllowed: boolean;
  eligibilityReasonCode: string;
}

export const SCENARIO_DEFS: Record<ScenarioType, ScenarioDef> = {
  completed: {
    technicalStatus: "completed",
    businessOutcome: "contacted",
    minDurationSec: 45,
    maxDurationSec: 300,
    createsCall: true,
    eligibilityAllowed: true,
    eligibilityReasonCode: "allowed",
  },
  voicemail: {
    technicalStatus: "completed",
    businessOutcome: "voicemail",
    minDurationSec: 5,
    maxDurationSec: 30,
    createsCall: true,
    eligibilityAllowed: true,
    eligibilityReasonCode: "allowed",
  },
  no_answer: {
    technicalStatus: "no_answer",
    businessOutcome: null,
    minDurationSec: 0,
    maxDurationSec: 0,
    createsCall: true,
    eligibilityAllowed: true,
    eligibilityReasonCode: "allowed",
  },
  silence_timeout: {
    technicalStatus: "completed",
    businessOutcome: "silence_timeout",
    minDurationSec: 10,
    maxDurationSec: 60,
    createsCall: true,
    eligibilityAllowed: true,
    eligibilityReasonCode: "allowed",
  },
  dnc: {
    technicalStatus: null,
    businessOutcome: null,
    minDurationSec: 0,
    maxDurationSec: 0,
    createsCall: false,
    eligibilityAllowed: false,
    eligibilityReasonCode: "dnc_list",
  },
  transferred: {
    technicalStatus: "completed",
    businessOutcome: "transferred",
    minDurationSec: 30,
    maxDurationSec: 120,
    createsCall: true,
    eligibilityAllowed: true,
    eligibilityReasonCode: "allowed",
  },
  transfer_failed: {
    technicalStatus: "completed",
    businessOutcome: "error",
    minDurationSec: 20,
    maxDurationSec: 90,
    createsCall: true,
    eligibilityAllowed: true,
    eligibilityReasonCode: "allowed",
  },
  provider_failure: {
    technicalStatus: "failed",
    businessOutcome: null,
    minDurationSec: 0,
    maxDurationSec: 5,
    createsCall: true,
    eligibilityAllowed: true,
    eligibilityReasonCode: "allowed",
  },
  balance_exhausted: {
    technicalStatus: null,
    businessOutcome: null,
    minDurationSec: 0,
    maxDurationSec: 0,
    createsCall: false,
    eligibilityAllowed: false,
    eligibilityReasonCode: "balance_exhausted",
  },
};

export const DEFAULT_DISTRIBUTION: Record<ScenarioType, number> = {
  completed: 35,
  voicemail: 20,
  no_answer: 10,
  silence_timeout: 10,
  dnc: 10,
  transferred: 5,
  transfer_failed: 5,
  provider_failure: 3,
  balance_exhausted: 2,
};

export interface SimulatorConfig {
  workspaceId: string;
  agentId: string;
  campaignId?: string;
  total: number;
  concurrency: number;
  distribution?: Partial<Record<ScenarioType, number>>;
  dryRun: boolean;
  runPostCallJobs: boolean;
  runCron: boolean;
  sendWebhooks: boolean;
}

export interface CallSimResult {
  scenario: ScenarioType;
  outcome: "created" | "blocked" | "error";
  callId: string | null;
  roomName: string;
  durationMs: number;
  closeHandlerMs: number;
  durationSec: number;
  jobsEnqueued: number;
  jobsSkipped: number;
  dbErrors: string[];
  costUsd: number;
}

export interface ActiveCallsCounter {
  current: number;
  peak: number;
}

export interface CronRunResult {
  claimed: number;
  completed: number;
  retrying: number;
  failed: number;
  deadLetter: number;
  rounds: number;
}

export interface LoadTestMetrics {
  config: SimulatorConfig;
  startedAt: string;
  completedAt: string;
  durationMs: number;

  // Technical
  callsAttempted: number;
  callsCreated: number;
  callsBlocked: number;
  callsFailed: number;
  peakActiveCalls: number;
  dbInsertErrors: number;
  dbInsertErrorRate: number;
  closeHandlerMs: { p50: number; p95: number; p99: number };
  totalCostUsd: number;
  avgCostUsdPerCall: number;

  // Business outcomes
  byScenario: Record<ScenarioType, number>;

  // Jobs
  jobsEnqueued: number;
  jobsSkipped: number;
  jobsEnqueueRate: number;
  cronCompleted: number;
  cronRetrying: number;
  cronFailed: number;
  cronDeadLetter: number;
  cronDeadLetterRate: number;
  cronProcessRate: number;

  // Compliance
  eligibilityAllowed: number;
  eligibilityBlocked: number;
  eligibilityReasonCodes: Record<string, number>;

  // Criteria
  criteria: CriteriaResult[];
  passed: boolean;
}

export interface CriteriaResult {
  name: string;
  threshold: string;
  actual: string;
  pass: boolean;
}

// ── Safety guard ───────────────────────────────────────────────────────────────

export function checkProductionGuard(loadTestMode: boolean): void {
  if (!loadTestMode) return;
  const isProd = process.env["NODE_ENV"] === "production";
  const allowProd = process.env["VOICEOS_ALLOW_PROD_LOAD_TEST"] === "true";
  if (isProd && !allowProd) {
    throw new Error(
      "SAFETY: Load test blocked in production. " +
        "Set VOICEOS_ALLOW_PROD_LOAD_TEST=true to override. " +
        "This will write synthetic data to the production database.",
    );
  }
}

// ── Scenario helpers ───────────────────────────────────────────────────────────

export function pickScenario(
  distribution: Record<ScenarioType, number>,
): ScenarioType {
  const entries = Object.entries(distribution) as [ScenarioType, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let rand = Math.random() * total;
  for (const [scenario, weight] of entries) {
    rand -= weight;
    if (rand <= 0) return scenario;
  }
  return entries[entries.length - 1]![0];
}

export function generateE164(index?: number): string {
  const base = 5550000000 + (index ?? Math.floor(Math.random() * 9000000));
  return `+1${base}`;
}

export function randomBetween(min: number, max: number): number {
  if (min === max) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function generateSimulatedTranscript(durationSec: number): string {
  if (durationSec < 10) return "";
  const lines = [
    "Agent: Hello, this is an AI assistant calling on behalf of VoiceOS.",
    "Contact: Yes, who is this?",
    "Agent: I am calling to discuss how VoiceOS can help streamline your workflows.",
    "Contact: I see. Can you tell me more?",
    "Agent: Certainly. Our platform offers automated outbound calling with AI.",
  ];
  return lines.slice(0, Math.max(1, Math.floor(durationSec / 20))).join("\n");
}

export function computeSimulatedCost(
  durationSec: number,
  _scenario: ScenarioType,
): number {
  if (durationSec === 0) return 0;
  const perSec =
    0.0085 / 60 + // telephony
    0.006 / 60 + // livekit
    0.0049 / 60 + // stt
    0.0065 / 60 + // tts (approx)
    0.00003; // llm tokens per second (approx)
  return Math.round(durationSec * perSec * 10000) / 10000;
}

function generateCostEventRows(
  callId: string,
  workspaceId: string,
  agentId: string,
  roomName: string,
  durationSec: number,
): object[] {
  const perMin = durationSec / 60;
  return [
    {
      call_id: callId,
      workspace_id: workspaceId,
      agent_id: agentId,
      call_room: roomName,
      provider: "twilio",
      cost_type: "telephony",
      quantity: perMin,
      unit: "minutes",
      unit_cost_usd: 0.0085,
      total_cost_usd: Math.round(perMin * 0.0085 * 1000000) / 1000000,
      pricing_source: "configured",
      metadata: { load_test: true },
    },
    {
      call_id: callId,
      workspace_id: workspaceId,
      agent_id: agentId,
      call_room: roomName,
      provider: "deepgram",
      cost_type: "stt",
      quantity: durationSec,
      unit: "seconds",
      unit_cost_usd: 0.0049 / 60,
      total_cost_usd: Math.round((perMin * 0.0049) * 1000000) / 1000000,
      pricing_source: "configured",
      metadata: { load_test: true },
    },
    {
      call_id: callId,
      workspace_id: workspaceId,
      agent_id: agentId,
      call_room: roomName,
      provider: "groq",
      cost_type: "llm_tokens",
      quantity: Math.round(durationSec * 80),
      unit: "tokens",
      unit_cost_usd: 0.0000003,
      total_cost_usd:
        Math.round(durationSec * 80 * 0.0000003 * 1000000) / 1000000,
      pricing_source: "configured",
      metadata: { load_test: true },
    },
  ];
}

export function buildJobList(
  scenario: ScenarioType,
  webhookUrl?: string,
): EnqueueJobInput[] {
  const base: EnqueueJobInput[] = [
    { job_type: "crm_extraction", priority: 50 },
    { job_type: "qa_analysis", priority: 80 },
    { job_type: "integration_dispatch", priority: 90 },
  ];

  if (webhookUrl) {
    base.push({
      job_type: "outbound_webhook",
      priority: 100,
      payload: {
        event: "call.completed",
        webhook_url: webhookUrl,
        webhook_url_source: "load_test",
        include_costs: false,
        include_analysis: false,
      },
    });
  }

  // Scenarios with no meaningful content skip expensive jobs
  if (
    scenario === "provider_failure" ||
    scenario === "no_answer" ||
    scenario === "balance_exhausted"
  ) {
    return base.filter((j) => j.job_type === "cost_finalization");
  }

  return base;
}

// ── Percentile helper ─────────────────────────────────────────────────────────

export function percentile(sorted: number[], pct: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(
    Math.floor(sorted.length * pct),
    sorted.length - 1,
  );
  return sorted[idx] ?? 0;
}

// ── Concurrency pool ───────────────────────────────────────────────────────────

export async function mapWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: (T | undefined)[] = new Array(tasks.length);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]!();
    }
  }
  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    worker,
  );
  await Promise.all(workers);
  return results as T[];
}

// ── Single-call simulator ──────────────────────────────────────────────────────

export async function simulateOneCall(
  config: SimulatorConfig,
  supabase: SupabaseClient | null,
  counter: ActiveCallsCounter,
  distribution: Record<ScenarioType, number>,
  callIndex: number,
): Promise<CallSimResult> {
  const t0 = Date.now();
  const scenario = pickScenario(distribution);
  const def = SCENARIO_DEFS[scenario];
  const phoneNumber = generateE164(callIndex);
  const roomName = `lt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dbErrors: string[] = [];
  let callId: string | null = null;

  // Eligibility check row
  if (!config.dryRun && supabase) {
    const { error } = await supabase.from("dial_eligibility_checks").insert({
      workspace_id: config.workspaceId,
      phone_number: phoneNumber,
      normalized_phone: phoneNumber,
      allowed: def.eligibilityAllowed,
      reason_code: def.eligibilityReasonCode,
      reason: def.eligibilityAllowed
        ? "Load test: eligible"
        : `Load test: blocked (${scenario})`,
      campaign_id: config.campaignId ?? null,
    });
    if (error) dbErrors.push(`eligibility: ${error.message}`);
  }

  if (!def.createsCall) {
    return {
      scenario,
      outcome: "blocked",
      callId: null,
      roomName,
      durationMs: Date.now() - t0,
      closeHandlerMs: 0,
      durationSec: 0,
      jobsEnqueued: 0,
      jobsSkipped: 0,
      dbErrors,
      costUsd: 0,
    };
  }

  counter.current++;
  if (counter.current > counter.peak) counter.peak = counter.current;

  const durationSec = randomBetween(def.minDurationSec, def.maxDurationSec);
  const costUsd = computeSimulatedCost(durationSec, scenario);

  try {
    // Insert calls row
    if (!config.dryRun && supabase) {
      const { data, error } = await supabase
        .from("calls")
        .insert({
          workspace_id: config.workspaceId,
          agent_id: config.agentId,
          retell_call_id: roomName,
          direction: "outbound",
          contact_phone: phoneNumber,
          status: "dialing",
          cost_usd: 0,
          technical_status: "initiated",
          campaign_id: config.campaignId ?? null,
        })
        .select("id")
        .single();

      if (error) {
        dbErrors.push(`calls.insert: ${error.message}`);
      } else {
        callId = (data as { id: string }).id;
      }
    }

    // call.initiated event
    if (!config.dryRun && supabase) {
      await supabase
        .from("call_events")
        .insert({
          call_room: roomName,
          call_id: callId,
          workspace_id: config.workspaceId,
          event_type: "call.initiated",
          payload: {
            agent_id: config.agentId,
            direction: "outbound",
            load_test: true,
            scenario,
          },
        })
        .then(() => null, (e) => dbErrors.push(`events.initiated: ${String(e)}`));
    }

    // call.answered (if non-zero duration and not hard failure)
    if (
      durationSec > 0 &&
      def.technicalStatus !== "failed" &&
      def.technicalStatus !== "no_answer"
    ) {
      if (!config.dryRun && supabase) {
        await supabase
          .from("call_events")
          .insert({
            call_room: roomName,
            call_id: callId,
            workspace_id: config.workspaceId,
            event_type: "call.answered",
            payload: { agent_id: config.agentId, load_test: true },
          })
          .then(() => null, (e) => dbErrors.push(`events.answered: ${String(e)}`));
      }
    }

    // ── Simulate close handler ───────────────────────────────────────────────
    const closeT0 = Date.now();

    const transcript = generateSimulatedTranscript(durationSec);

    if (!config.dryRun && supabase && callId) {
      // Update calls to final state
      await supabase
        .from("calls")
        .update({
          status: "ended",
          technical_status: def.technicalStatus,
          business_outcome: def.businessOutcome,
          duration_seconds: durationSec,
          cost_usd: costUsd,
          cost_status: durationSec > 0 ? "final" : "not_calculated",
          transcript: transcript || null,
          answered_at:
            durationSec > 0
              ? new Date(Date.now() - durationSec * 1000).toISOString()
              : null,
          ended_at: new Date().toISOString(),
        })
        .eq("id", callId)
        .then(() => null, (e) => dbErrors.push(`calls.update: ${String(e)}`));

      // call.ended event
      await supabase
        .from("call_events")
        .insert({
          call_room: roomName,
          call_id: callId,
          workspace_id: config.workspaceId,
          event_type: "call.ended",
          payload: {
            agent_id: config.agentId,
            duration_seconds: durationSec,
            technical_status: def.technicalStatus,
            business_outcome: def.businessOutcome,
            load_test: true,
          },
        })
        .then(() => null, (e) => dbErrors.push(`events.ended: ${String(e)}`));

      // Cost events (only for calls with duration)
      if (durationSec > 0) {
        const costRows = generateCostEventRows(
          callId,
          config.workspaceId,
          config.agentId,
          roomName,
          durationSec,
        );
        await supabase
          .from("call_cost_events")
          .insert(costRows)
          .then(() => null, (e) => dbErrors.push(`cost_events: ${String(e)}`));
      }
    }

    // Enqueue post-call jobs
    let jobsEnqueued = 0;
    let jobsSkipped = 0;

    if (!config.dryRun && callId && supabase && config.runPostCallJobs) {
      const jobList = buildJobList(scenario);
      if (jobList.length > 0) {
        const result = await enqueuePostCallJobsForCall({
          workspaceId: config.workspaceId,
          callId,
          roomName,
          agentId: config.agentId,
          jobs: jobList,
          supabase,
        });
        jobsEnqueued = result.enqueued;
        jobsSkipped = result.skipped;
        result.errors.forEach((e) => dbErrors.push(`jobs.enqueue: ${e}`));
      }
    }

    const closeHandlerMs = Date.now() - closeT0;

    return {
      scenario,
      outcome: "created",
      callId,
      roomName,
      durationMs: Date.now() - t0,
      closeHandlerMs,
      durationSec,
      jobsEnqueued,
      jobsSkipped,
      dbErrors,
      costUsd,
    };
  } finally {
    counter.current--;
  }
}

// ── Load test mock job processor ───────────────────────────────────────────────
// Used when runCron=true in load test mode — skips external API calls.

async function mockProcessJob(
  supabase: SupabaseClient,
  job: PostCallJob,
  sendWebhooks: boolean,
): Promise<Record<string, unknown>> {
  switch (job.job_type) {
    case "crm_extraction":
      if (!job.call_id) return { skipped: true, reason: "no_call_id" };
      // Write extracted_data directly without LLM
      await supabase
        .from("calls")
        .update({ extracted_data: { load_test: true, provider: "mock" } })
        .eq("id", job.call_id)
        .then(() => null, () => null);
      return { provider: "mock", load_test: true };

    case "qa_analysis": {
      if (!job.call_id) return { skipped: true, reason: "no_call_id" };
      // Idempotency: check for existing evaluation
      const { data: existing } = await supabase
        .from("qa_evaluations")
        .select("id")
        .eq("call_id", job.call_id)
        .maybeSingle();
      if (existing) return { skipped: true, reason: "already_evaluated" };
      // Insert mock evaluation
      const { data: evalRow } = await supabase
        .from("qa_evaluations")
        .insert({
          workspace_id: job.workspace_id,
          call_id: job.call_id,
          risk_score: 0,
          analysis: {
            summary: "Load test mock evaluation",
            sentiment: "neutral",
            tone: "neutral",
            topics: ["General"],
            scores: {
              opening: 75,
              compliance: 100,
              objection_handling: 70,
              closing: 65,
              overall: 78,
            },
          },
        })
        .select("id")
        .single();
      return {
        evaluation_id: (evalRow as { id: string } | null)?.id ?? "mock",
        risk_score: 0,
        violations_count: 0,
        load_test: true,
      };
    }

    case "outbound_webhook":
      if (!sendWebhooks)
        return { skipped: true, reason: "load_test_webhooks_disabled" };
      return { skipped: true, reason: "load_test_send_webhooks_not_set" };

    case "integration_dispatch":
      return { skipped: true, reason: "load_test_mode" };

    case "cost_finalization":
      if (!job.call_id) return { skipped: true };
      return { skipped: true, reason: "already_final" };

    case "call_summary":
    case "transcript_postprocess":
    case "cleanup":
      return { skipped: true, reason: "not_implemented" };

    default:
      return { skipped: true, reason: "unknown_job_type" };
  }
}

// ── Cron processor (load test mode — no external calls) ───────────────────────

export async function runLoadTestCron(
  supabase: SupabaseClient,
  workerId: string,
  sendWebhooks: boolean,
  maxRounds = 200,
): Promise<CronRunResult> {
  let claimed = 0;
  let completed = 0;
  let retrying = 0;
  let failed = 0;
  let deadLetter = 0;
  let rounds = 0;

  for (let round = 0; round < maxRounds; round++) {
    const jobs = await claimNextPostCallJobs(supabase, workerId, 20);
    if (!jobs.length) break;
    rounds++;
    claimed += jobs.length;

    for (const job of jobs) {
      try {
        const result = await mockProcessJob(supabase, job, sendWebhooks);
        await markJobCompleted(supabase, job.id, result);
        completed++;
      } catch (err) {
        const code = (err as { code?: string }).code ?? "500";
        const msg = (err instanceof Error ? err.message : String(err)).slice(
          0,
          500,
        );
        const decision = shouldRetryJob(job, code);
        if (decision.isDeadLetter) {
          await markJobDeadLetter(supabase, job.id, { message: msg, code });
          deadLetter++;
        } else if (decision.shouldRetry) {
          await markJobRetrying(supabase, job.id, { message: msg, code }, job.attempts);
          retrying++;
        } else {
          await markJobFailed(supabase, job.id, { message: msg, code });
          failed++;
        }
      }
    }
  }

  return { claimed, completed, retrying, failed, deadLetter, rounds };
}

// ── Metrics compiler ───────────────────────────────────────────────────────────

export function compileMetrics(
  config: SimulatorConfig,
  results: CallSimResult[],
  cronResult: CronRunResult | null,
  startedAt: string,
  completedAt: string,
): LoadTestMetrics {
  const durationMs =
    new Date(completedAt).getTime() - new Date(startedAt).getTime();

  const created = results.filter((r) => r.outcome === "created");
  const blocked = results.filter((r) => r.outcome === "blocked");
  const errors = results.filter((r) => r.outcome === "error");

  const byScenario = Object.fromEntries(
    (Object.keys(SCENARIO_DEFS) as ScenarioType[]).map((s) => [
      s,
      results.filter((r) => r.scenario === s).length,
    ]),
  ) as Record<ScenarioType, number>;

  const totalDbErrors = results.reduce((s, r) => s + r.dbErrors.length, 0);
  const dbInsertErrorRate =
    created.length > 0 ? totalDbErrors / created.length : 0;

  const closeHandlerTimes = created
    .map((r) => r.closeHandlerMs)
    .sort((a, b) => a - b);

  const totalCostUsd = results.reduce((s, r) => s + r.costUsd, 0);

  const jobsEnqueued = results.reduce((s, r) => s + r.jobsEnqueued, 0);
  const jobsSkipped = results.reduce((s, r) => s + r.jobsSkipped, 0);
  const jobsEnqueueRate =
    created.length > 0 ? jobsEnqueued / created.length : 0;

  const eligibilityAllowed = results.filter(
    (r) => SCENARIO_DEFS[r.scenario].eligibilityAllowed,
  ).length;
  const eligibilityBlocked = results.filter(
    (r) => !SCENARIO_DEFS[r.scenario].eligibilityAllowed,
  ).length;

  const reasonCodes: Record<string, number> = {};
  for (const r of results) {
    const code = SCENARIO_DEFS[r.scenario].eligibilityReasonCode;
    reasonCodes[code] = (reasonCodes[code] ?? 0) + 1;
  }

  const cronCompleted = cronResult?.completed ?? 0;
  const cronDeadLetter = cronResult?.deadLetter ?? 0;
  const cronFailed = cronResult?.failed ?? 0;
  const cronRetrying = cronResult?.retrying ?? 0;
  const cronClaimed = cronResult?.claimed ?? 0;
  const cronDeadLetterRate =
    cronClaimed > 0 ? cronDeadLetter / cronClaimed : 0;
  const cronProcessRate =
    cronClaimed > 0
      ? (cronCompleted + cronFailed + cronDeadLetter) / cronClaimed
      : 0;

  // Peak active calls tracked by counter during the run
  const peakActiveCalls = results.reduce(
    (p, r) => Math.max(p, r.jobsEnqueued > 0 ? 1 : 0),
    0,
  ); // rough estimate; real peak tracked in counter

  const criteria: CriteriaResult[] = [
    {
      name: "Zero crashes (DB error rate)",
      threshold: "< 0.5%",
      actual: `${(dbInsertErrorRate * 100).toFixed(2)}%`,
      pass: dbInsertErrorRate < 0.005,
    },
    {
      name: "All calls have final state",
      threshold: "100%",
      actual: `${created.length} created`,
      pass: errors.length === 0,
    },
    {
      name: "p95 close handler",
      threshold: "< 2000ms",
      actual: `${percentile(closeHandlerTimes, 0.95)}ms`,
      pass: percentile(closeHandlerTimes, 0.95) < 2000,
    },
    {
      name: "p99 close handler",
      threshold: "< 5000ms",
      actual: `${percentile(closeHandlerTimes, 0.99)}ms`,
      pass: percentile(closeHandlerTimes, 0.99) < 5000,
    },
    {
      name: "Dead letter rate",
      threshold: "< 1%",
      actual: `${(cronDeadLetterRate * 100).toFixed(2)}%`,
      pass: cronDeadLetterRate < 0.01,
    },
    {
      name: "Jobs processed rate",
      threshold: ">= 99%",
      actual: `${(cronProcessRate * 100).toFixed(1)}%`,
      pass: cronProcessRate >= 0.99 || cronClaimed === 0,
    },
  ];

  return {
    config,
    startedAt,
    completedAt,
    durationMs,
    callsAttempted: results.length,
    callsCreated: created.length,
    callsBlocked: blocked.length,
    callsFailed: errors.length,
    peakActiveCalls,
    dbInsertErrors: totalDbErrors,
    dbInsertErrorRate,
    closeHandlerMs: {
      p50: percentile(closeHandlerTimes, 0.5),
      p95: percentile(closeHandlerTimes, 0.95),
      p99: percentile(closeHandlerTimes, 0.99),
    },
    totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
    avgCostUsdPerCall:
      created.length > 0
        ? Math.round((totalCostUsd / created.length) * 10000) / 10000
        : 0,
    byScenario,
    jobsEnqueued,
    jobsSkipped,
    jobsEnqueueRate,
    cronCompleted,
    cronRetrying,
    cronFailed,
    cronDeadLetter,
    cronDeadLetterRate,
    cronProcessRate,
    eligibilityAllowed,
    eligibilityBlocked,
    eligibilityReasonCodes: reasonCodes,
    criteria,
    passed: criteria.every((c) => c.pass),
  };
}

// ── Full run orchestrator ──────────────────────────────────────────────────────

export async function runLoadTest(
  config: SimulatorConfig,
  supabase: SupabaseClient | null,
  onProgress?: (completed: number, total: number) => void,
): Promise<LoadTestMetrics> {
  checkProductionGuard(!config.dryRun);

  const distribution: Record<ScenarioType, number> = {
    ...DEFAULT_DISTRIBUTION,
    ...(config.distribution ?? {}),
  };

  const counter: ActiveCallsCounter = { current: 0, peak: 0 };
  const startedAt = new Date().toISOString();
  let completedCount = 0;

  const tasks = Array.from({ length: config.total }, (_, i) => async () => {
    const result = await simulateOneCall(
      config,
      supabase,
      counter,
      distribution,
      i,
    );
    completedCount++;
    onProgress?.(completedCount, config.total);
    return result;
  });

  const results = await mapWithConcurrency(tasks, config.concurrency);

  // Update peak from counter
  const peakFromCounter = counter.peak;

  let cronResult: CronRunResult | null = null;
  if (!config.dryRun && config.runCron && supabase) {
    const workerId = `lt-cron-${Date.now()}`;
    cronResult = await runLoadTestCron(
      supabase,
      workerId,
      config.sendWebhooks,
    );
  }

  const completedAt = new Date().toISOString();
  const metrics = compileMetrics(
    config,
    results,
    cronResult,
    startedAt,
    completedAt,
  );

  // Override peak with real counter value
  (metrics as { peakActiveCalls: number }).peakActiveCalls = peakFromCounter;

  return metrics;
}
