/**
 * VoiceOS Operational Worker
 *
 * Persistent background process (Render) that runs recurring job loops:
 *   - post_call_jobs processor   every 30 s    (VOICEOS_RUN_POST_CALL_JOBS)
 *   - provider health snapshots  every 5 min   (VOICEOS_RUN_PROVIDER_HEALTH)
 *   - alert signal evaluation    every 5 min   (VOICEOS_RUN_ALERTS)
 *   - campaign dial              every 60 s    (VOICEOS_RUN_CAMPAIGN_DIAL — OFF by default)
 *   - recovery sweeper           every 60 min  (VOICEOS_RUN_RECOVERY — OFF by default)
 *
 * Feature flags (all default to safe values):
 *   VOICEOS_OPERATIONAL_WORKER_ENABLED=true   must be set to start
 *   VOICEOS_RUN_POST_CALL_JOBS=true
 *   VOICEOS_RUN_PROVIDER_HEALTH=true
 *   VOICEOS_RUN_ALERTS=true
 *   VOICEOS_RUN_CAMPAIGN_DIAL=false           OFF — prevents real calls
 *   VOICEOS_RUN_RECOVERY=false                OFF — manual only
 *
 * Security:
 *   - VOICEOS_ALERTING_SEND_EXTERNAL must be false (no real Slack/email)
 *   - VOICEOS_LOAD_TEST_MODE must be false in production
 *   - INTERNAL_API_SECRET must be set for campaign-dial proxy
 *   - Secrets are never printed
 */

import { runPostCallJobs } from "@/lib/cron/post-call-jobs-runner";
import { runProviderHealth } from "@/lib/cron/provider-health-runner";
import { runAlerts } from "@/lib/cron/alerts-runner";
import { runCampaignDial } from "@/lib/cron/campaign-dial-runner";
import { runRecovery } from "@/lib/cron/recovery-runner";

// ── Feature flags ─────────────────────────────────────────────────────────────

function flag(name: string, defaultValue: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return defaultValue;
  return v === "true";
}

const FLAGS = {
  enabled: flag("VOICEOS_OPERATIONAL_WORKER_ENABLED", false),
  postCallJobs: flag("VOICEOS_RUN_POST_CALL_JOBS", true),
  providerHealth: flag("VOICEOS_RUN_PROVIDER_HEALTH", true),
  alerts: flag("VOICEOS_RUN_ALERTS", true),
  campaignDial: flag("VOICEOS_RUN_CAMPAIGN_DIAL", false),
  recovery: flag("VOICEOS_RUN_RECOVERY", false),
};

// ── Intervals (ms) ────────────────────────────────────────────────────────────

const INTERVALS = {
  postCallJobs: 30_000,
  providerHealth: 5 * 60_000,
  alerts: 5 * 60_000,
  campaignDial: 60_000,
  recovery: 60 * 60_000,
};

// ── Worker ID ─────────────────────────────────────────────────────────────────

const WORKER_ID = `operational-${process.env["RENDER_SERVICE_ID"] ?? "local"}-${Date.now()}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[operational-worker] ${new Date().toISOString()} ${msg}`);
}

function err(msg: string, e?: unknown) {
  console.error(
    `[operational-worker] ${new Date().toISOString()} ERROR ${msg}`,
    e instanceof Error ? e.message : e,
  );
}

async function safeRun<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  try {
    const result = await fn();
    log(`${name} completed`);
    return result;
  } catch (e) {
    err(`${name} failed`, e);
    return null;
  }
}

// ── Loop starters ─────────────────────────────────────────────────────────────

function startPostCallJobsLoop() {
  if (!FLAGS.postCallJobs) {
    log("post_call_jobs loop DISABLED (VOICEOS_RUN_POST_CALL_JOBS=false)");
    return;
  }
  log(`post_call_jobs loop starting (every ${INTERVALS.postCallJobs / 1000}s)`);

  const run = () =>
    safeRun("post_call_jobs", () =>
      runPostCallJobs({ workerId: WORKER_ID, limit: 10 }),
    );

  // Run immediately on start, then on interval
  void run();
  setInterval(run, INTERVALS.postCallJobs);
}

function startProviderHealthLoop() {
  if (!FLAGS.providerHealth) {
    log("provider_health loop DISABLED (VOICEOS_RUN_PROVIDER_HEALTH=false)");
    return;
  }
  log(
    `provider_health loop starting (every ${INTERVALS.providerHealth / 60_000}min)`,
  );

  const run = () =>
    safeRun("provider_health", () => runProviderHealth({ windowMinutes: 5 }));

  void run();
  setInterval(run, INTERVALS.providerHealth);
}

function startAlertsLoop() {
  if (!FLAGS.alerts) {
    log("alerts loop DISABLED (VOICEOS_RUN_ALERTS=false)");
    return;
  }
  log(`alerts loop starting (every ${INTERVALS.alerts / 60_000}min)`);

  const run = () => safeRun("alerts", () => runAlerts({ windowMinutes: 15 }));

  void run();
  setInterval(run, INTERVALS.alerts);
}

function startCampaignDialLoop() {
  if (!FLAGS.campaignDial) {
    log(
      "campaign_dial loop DISABLED by default (set VOICEOS_RUN_CAMPAIGN_DIAL=true to enable)",
    );
    return;
  }

  if (process.env["VOICEOS_LOAD_TEST_MODE"] === "true") {
    log("campaign_dial loop BLOCKED — VOICEOS_LOAD_TEST_MODE=true");
    return;
  }

  log(
    `campaign_dial loop starting (every ${INTERVALS.campaignDial / 1000}s) — REAL CALLS ENABLED`,
  );

  const run = () =>
    safeRun("campaign_dial", () =>
      runCampaignDial({
        appBaseUrl: process.env["NEXT_PUBLIC_APP_URL"],
        internalSecret: process.env["INTERNAL_API_SECRET"],
      }),
    );

  void run();
  setInterval(run, INTERVALS.campaignDial);
}

function startRecoveryLoop() {
  if (!FLAGS.recovery) {
    log(
      "recovery loop DISABLED by default (set VOICEOS_RUN_RECOVERY=true to enable)",
    );
    return;
  }
  log(`recovery loop starting (every ${INTERVALS.recovery / 60_000}min)`);

  const run = () =>
    safeRun("recovery", () => runRecovery({ hours: 48, dryRun: false }));

  // Delay first run by 5 minutes to let post-call jobs process first
  setTimeout(() => {
    void run();
    setInterval(run, INTERVALS.recovery);
  }, 5 * 60_000);
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  if (!FLAGS.enabled) {
    console.error(
      "[operational-worker] VOICEOS_OPERATIONAL_WORKER_ENABLED is not set to true — exiting.",
    );
    process.exit(1);
  }

  log(`starting — worker_id=${WORKER_ID}`);
  log(
    `flags: post_call_jobs=${FLAGS.postCallJobs} provider_health=${FLAGS.providerHealth} ` +
      `alerts=${FLAGS.alerts} campaign_dial=${FLAGS.campaignDial} recovery=${FLAGS.recovery}`,
  );

  // Safety checks
  if (process.env["VOICEOS_ALERTING_SEND_EXTERNAL"] === "true") {
    log(
      "WARNING: VOICEOS_ALERTING_SEND_EXTERNAL=true — real Slack/email alerts will fire",
    );
  }

  startPostCallJobsLoop();
  startProviderHealthLoop();
  startAlertsLoop();
  startCampaignDialLoop();
  startRecoveryLoop();

  log("all loops started — operational worker is running");
}

main();
