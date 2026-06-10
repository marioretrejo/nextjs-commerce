#!/usr/bin/env npx tsx
/**
 * VoiceOS Load Test — Controlled Call Simulation
 *
 * Simulates N outbound calls at the DB layer without touching real telecom
 * providers. Writes actual rows to Supabase (calls, call_events, call_cost_events,
 * post_call_jobs, dial_eligibility_checks) so the full post-call pipeline can
 * be exercised under controlled load.
 *
 * SAFETY: This script never creates real Twilio calls, LiveKit rooms, or
 * invokes STT/TTS/LLM APIs. All simulated calls are tagged `load_test=true`.
 *
 * Usage:
 *   pnpm load:test -- --workspace-id <id> --agent-id <id> --total 100 --dry-run
 *   pnpm load:test -- --workspace-id <id> --agent-id <id> --total 1000 --concurrency 50
 *
 * Required env vars (in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   VOICEOS_LOAD_TEST_MODE=true    (set via --load-test-mode flag or env)
 *   VOICEOS_ALLOW_PROD_LOAD_TEST=true  (required if NODE_ENV=production)
 *   VOICEOS_LOAD_TEST_SEND_WEBHOOKS=true  (send real webhooks; default off)
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  runLoadTest,
  checkProductionGuard,
  type SimulatorConfig,
  type LoadTestMetrics,
  type ScenarioType,
} from "@/lib/load-test/simulator";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// ── Arg parser ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
function getArg(flag: string, def: string): string {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1]! : def;
}
function hasFlag(flag: string): boolean {
  return argv.includes(flag);
}

const workspaceId = getArg("--workspace-id", "");
const agentId = getArg("--agent-id", "");
const campaignId = getArg("--campaign-id", "") || undefined;
const total = Math.max(1, parseInt(getArg("--total", "100"), 10));
const concurrency = Math.max(1, parseInt(getArg("--concurrency", "10"), 10));
const dryRun = hasFlag("--dry-run");
const loadTestMode =
  hasFlag("--load-test-mode") ||
  process.env["VOICEOS_LOAD_TEST_MODE"] === "true";
const runPostCallJobs = getArg("--post-call-jobs", "true") !== "false";
const runCron = getArg("--run-cron", "true") !== "false";
const sendWebhooks =
  process.env["VOICEOS_LOAD_TEST_SEND_WEBHOOKS"] === "true" ||
  hasFlag("--send-webhooks");
const outputDir = getArg("--output-dir", "reports");

// ── Validation ────────────────────────────────────────────────────────────────

if (!workspaceId || !agentId) {
  console.error(
    "Usage: pnpm load:test -- --workspace-id <id> --agent-id <id> [options]\n" +
      "\n" +
      "Options:\n" +
      "  --total <n>           Number of calls to simulate (default: 100)\n" +
      "  --concurrency <n>     Max concurrent calls (default: 10)\n" +
      "  --campaign-id <id>    Optional campaign ID to associate calls with\n" +
      "  --dry-run             Simulate without writing to DB\n" +
      "  --load-test-mode      Activate load test mode (required for DB writes)\n" +
      "  --post-call-jobs      Enqueue post-call jobs (default: true)\n" +
      "  --run-cron            Run cron processor after calls (default: true)\n" +
      "  --send-webhooks       Enable outbound webhook delivery (default: false)\n" +
      "  --output-dir <dir>    Directory for report files (default: reports)\n",
  );
  process.exit(1);
}

if (!dryRun && !loadTestMode) {
  console.error(
    "ERROR: --load-test-mode is required for DB writes.\n" +
      "Use --dry-run for a safe simulation without DB writes.\n" +
      "Set VOICEOS_LOAD_TEST_MODE=true or pass --load-test-mode to enable.\n",
  );
  process.exit(1);
}

// Production guard
try {
  checkProductionGuard(!dryRun);
} catch (err) {
  console.error(`\n${(err as Error).message}\n`);
  process.exit(1);
}

// ── Supabase client ───────────────────────────────────────────────────────────

function createAdminClient() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    console.error(
      "ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local",
    );
    process.exit(1);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Report formatter ──────────────────────────────────────────────────────────

function formatReport(m: LoadTestMetrics): string {
  const lines: string[] = [];

  const fmt = (v: number) => v.toFixed(2);
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("  VoiceOS Load Test Report");
  lines.push(`  Run ID : ${runId}`);
  lines.push(`  Started: ${m.startedAt}`);
  lines.push(`  Ended  : ${m.completedAt}`);
  lines.push(`  Total  : ${(m.durationMs / 1000).toFixed(1)}s`);
  lines.push("═══════════════════════════════════════════════════════════");

  lines.push("\n── Technical ──────────────────────────────────────────────");
  lines.push(`  Calls attempted:      ${m.callsAttempted}`);
  lines.push(`  Calls created (DB):   ${m.callsCreated}`);
  lines.push(`  Calls blocked:        ${m.callsBlocked}`);
  lines.push(`  Calls errored:        ${m.callsFailed}`);
  lines.push(`  Peak active calls:    ${m.peakActiveCalls}`);
  lines.push(`  DB insert error rate: ${pct(m.dbInsertErrorRate)}`);
  lines.push(`  Close handler p50:    ${m.closeHandlerMs.p50}ms`);
  lines.push(`  Close handler p95:    ${m.closeHandlerMs.p95}ms`);
  lines.push(`  Close handler p99:    ${m.closeHandlerMs.p99}ms`);

  lines.push("\n── Business Outcomes ──────────────────────────────────────");
  const total = m.callsAttempted || 1;
  for (const [scenario, count] of Object.entries(m.byScenario) as [
    ScenarioType,
    number,
  ][]) {
    lines.push(
      `  ${scenario.padEnd(20)} ${String(count).padStart(5)}  (${pct(count / total)})`,
    );
  }

  lines.push("\n── Post-Call Jobs ─────────────────────────────────────────");
  lines.push(`  Jobs enqueued:     ${m.jobsEnqueued}`);
  lines.push(`  Jobs skipped:      ${m.jobsSkipped}`);
  lines.push(`  Enqueue rate:      ${pct(m.jobsEnqueueRate)}`);
  if (m.cronCompleted + m.cronFailed + m.cronDeadLetter + m.cronRetrying > 0) {
    lines.push(`  Cron completed:    ${m.cronCompleted}`);
    lines.push(`  Cron retrying:     ${m.cronRetrying}`);
    lines.push(`  Cron failed:       ${m.cronFailed}`);
    lines.push(`  Cron dead-letter:  ${m.cronDeadLetter}`);
    lines.push(`  Dead-letter rate:  ${pct(m.cronDeadLetterRate)}`);
    lines.push(`  Processed rate:    ${pct(m.cronProcessRate)}`);
  }

  lines.push("\n── Costs ──────────────────────────────────────────────────");
  lines.push(`  Total estimated:   $${fmt(m.totalCostUsd)}`);
  lines.push(`  Average per call:  $${fmt(m.avgCostUsdPerCall)}`);

  lines.push("\n── Compliance ─────────────────────────────────────────────");
  lines.push(`  Eligibility allowed: ${m.eligibilityAllowed}`);
  lines.push(`  Eligibility blocked: ${m.eligibilityBlocked}`);
  for (const [code, count] of Object.entries(m.eligibilityReasonCodes)) {
    lines.push(`    ${code}: ${count}`);
  }

  lines.push("\n── Approval Criteria ──────────────────────────────────────");
  for (const c of m.criteria) {
    const icon = c.pass ? "✓" : "✗";
    lines.push(
      `  ${icon}  ${c.name.padEnd(36)} ${c.actual.padStart(12)} (threshold: ${c.threshold})`,
    );
  }

  lines.push("");
  lines.push(
    m.passed
      ? "  ✓ PASSED — all approval criteria met"
      : "  ✗ FAILED — one or more criteria not met",
  );
  lines.push("═══════════════════════════════════════════════════════════");

  return lines.join("\n");
}

function buildMarkdownReport(m: LoadTestMetrics, id: string): string {
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const usd = (v: number) => `$${v.toFixed(4)}`;
  const sections: string[] = [];

  sections.push(`# VoiceOS Load Test Report`);
  sections.push(`\n**Run ID:** ${id}  `);
  sections.push(`**Started:** ${m.startedAt}  `);
  sections.push(`**Duration:** ${(m.durationMs / 1000).toFixed(1)}s  `);
  sections.push(`**Result:** ${m.passed ? "✅ PASSED" : "❌ FAILED"}`);

  sections.push(`\n## Technical Metrics\n`);
  sections.push(`| Metric | Value |`);
  sections.push(`|--------|-------|`);
  sections.push(`| Calls attempted | ${m.callsAttempted} |`);
  sections.push(`| Calls created | ${m.callsCreated} |`);
  sections.push(`| Calls blocked | ${m.callsBlocked} |`);
  sections.push(`| Calls errored | ${m.callsFailed} |`);
  sections.push(`| Peak active calls | ${m.peakActiveCalls} |`);
  sections.push(`| DB error rate | ${pct(m.dbInsertErrorRate)} |`);
  sections.push(`| Close handler p50 | ${m.closeHandlerMs.p50}ms |`);
  sections.push(`| Close handler p95 | ${m.closeHandlerMs.p95}ms |`);
  sections.push(`| Close handler p99 | ${m.closeHandlerMs.p99}ms |`);

  sections.push(`\n## Business Outcomes\n`);
  sections.push(`| Scenario | Count | % |`);
  sections.push(`|----------|-------|---|`);
  for (const [s, n] of Object.entries(m.byScenario)) {
    sections.push(`| ${s} | ${n} | ${pct(n / (m.callsAttempted || 1))} |`);
  }

  sections.push(`\n## Post-Call Jobs\n`);
  sections.push(`| Metric | Value |`);
  sections.push(`|--------|-------|`);
  sections.push(`| Enqueued | ${m.jobsEnqueued} |`);
  sections.push(`| Skipped (idempotent) | ${m.jobsSkipped} |`);
  sections.push(`| Cron completed | ${m.cronCompleted} |`);
  sections.push(`| Cron dead-letter | ${m.cronDeadLetter} |`);
  sections.push(`| Dead-letter rate | ${pct(m.cronDeadLetterRate)} |`);

  sections.push(`\n## Cost Summary\n`);
  sections.push(
    `- Total estimated cost: ${usd(m.totalCostUsd)} (synthetic, not billed)`,
  );
  sections.push(`- Average per call: ${usd(m.avgCostUsdPerCall)}`);

  sections.push(`\n## Approval Criteria\n`);
  sections.push(`| Criterion | Threshold | Actual | Pass |`);
  sections.push(`|-----------|-----------|--------|------|`);
  for (const c of m.criteria) {
    sections.push(
      `| ${c.name} | ${c.threshold} | ${c.actual} | ${c.pass ? "✅" : "❌"} |`,
    );
  }

  return sections.join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

const now = new Date();
const runId = `lt-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

async function main() {
  const config: SimulatorConfig = {
    workspaceId,
    agentId,
    campaignId,
    total,
    concurrency,
    dryRun,
    runPostCallJobs,
    runCron: runCron && !dryRun,
    sendWebhooks,
  };

  const supabase = dryRun ? null : createAdminClient();

  console.log(
    JSON.stringify(
      {
        type: "load_test.start",
        run_id: runId,
        workspace_id: workspaceId,
        agent_id: agentId,
        total,
        concurrency,
        dry_run: dryRun,
        load_test_mode: loadTestMode,
        run_post_call_jobs: runPostCallJobs,
        run_cron: config.runCron,
      },
      null,
      2,
    ),
  );

  let lastPrinted = 0;
  const metrics = await runLoadTest(config, supabase, (done, total) => {
    // Print progress every 10% or every 50 calls, whichever is more frequent
    const pct = Math.floor((done / total) * 10);
    if (pct > lastPrinted || done % 50 === 0) {
      lastPrinted = pct;
      process.stdout.write(
        `\r  Progress: ${done}/${total} (${Math.round((done / total) * 100)}%)  `,
      );
    }
  });

  process.stdout.write("\n");

  // Print formatted report
  console.log(formatReport(metrics));

  // Save JSON report
  if (!dryRun) {
    const jsonPath = path.join(outputDir, `${runId}.json`);
    const mdPath = path.join(outputDir, `${runId}.md`);

    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(
      jsonPath,
      JSON.stringify({ run_id: runId, ...metrics }, null, 2),
    );
    console.log(`\n  Report saved: ${jsonPath}`);

    fs.writeFileSync(mdPath, buildMarkdownReport(metrics, runId));
    console.log(`  Report saved: ${mdPath}`);
  }

  // SQL validation queries hint
  if (!dryRun) {
    console.log(`
── Validation queries ──────────────────────────────────────────
  -- Calls without post_call_jobs (should be 0 after recovery):
  SELECT c.id, c.technical_status FROM calls c
  WHERE c.created_at > now() - interval '1 hour'
    AND NOT EXISTS (SELECT 1 FROM post_call_jobs j WHERE j.call_id = c.id)
    AND (c.routing_data->>'method' = 'load_test');

  -- Duplicate jobs (should be 0):
  SELECT call_id, job_type, count(*) FROM post_call_jobs
  WHERE created_at > now() - interval '1 hour'
  GROUP BY call_id, job_type HAVING count(*) > 1;

  -- Jobs still running (should be 0 after cron):
  SELECT count(*) FROM post_call_jobs
  WHERE status = 'running'
    AND locked_at < now() - interval '10 minutes';

  -- Cleanup load test data:
  -- DELETE FROM calls WHERE routing_data->>'method' = 'load_test';
────────────────────────────────────────────────────────────────
`);
  }

  process.exit(metrics.passed ? 0 : 1);
}

main().catch((err) => {
  console.error("\nFATAL:", err);
  process.exit(1);
});
