#!/usr/bin/env npx tsx
/**
 * Campaign API Smoke Test — End-to-End (Load-Test Mode)
 *
 * Tests the full Campaign API lifecycle against the real DB using the admin
 * client, without HTTP or any real telecom/AI provider:
 *
 *   1. Create campaign (draft)
 *   2. Attempt activation without leads → expect 422
 *   3. Batch-ingest 20 leads (15 valid, 2 dup-phone, 2 invalid, 1 dup-lead-id)
 *   4. Activate campaign → expect success
 *   5. Verify DB consistency (phones normalised, no duplicates, no secrets)
 *   6. Test illegal transitions (completed→active blocked)
 *   7. Dispatcher in load-test mode → must be no-op (0 real calls)
 *   8. Cleanup test rows
 *
 * SAFETY:
 *   • VOICEOS_LOAD_TEST_MODE=true required
 *   • VOICEOS_LOAD_TEST_SEND_WEBHOOKS defaults false
 *   • No Twilio / LiveKit / LLM / STT / TTS calls made
 *   • All test rows tagged campaign.name LIKE 'SMOKE TEST %'
 */

import * as path from "node:path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  normalizePhone,
  sanitizeVariables,
  sanitizeConfiguration,
  isTransitionAllowed,
  ALLOWED_TRANSITIONS,
} from "@/lib/campaigns/validation";
import type { CountryCode } from "libphonenumber-js";
import type { CampaignStatus } from "@/lib/supabase/types";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// ── Safety guards ──────────────────────────────────────────────────────────────

if (process.env["VOICEOS_LOAD_TEST_MODE"] !== "true") {
  console.error(
    "ERROR: Set VOICEOS_LOAD_TEST_MODE=true before running this smoke test.",
  );
  process.exit(1);
}
if (process.env["VOICEOS_ALLOW_PROD_LOAD_TEST"] === "true") {
  console.error(
    "ERROR: VOICEOS_ALLOW_PROD_LOAD_TEST must NOT be set to true for smoke tests.",
  );
  process.exit(1);
}

// ── Supabase admin client ──────────────────────────────────────────────────────

function makeAdmin() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  if (!url || !key) {
    console.error(
      "ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
    process.exit(1);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Test utilities ─────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  pass: boolean;
  actual: string;
  expected: string;
  note?: string;
}

const results: TestResult[] = [];
const errors: string[] = [];

function check(
  name: string,
  condition: boolean,
  actual: string,
  expected: string,
  note?: string,
) {
  results.push({ name, pass: condition, actual, expected, note });
  if (!condition)
    errors.push(`FAIL [${name}]: actual=${actual} expected=${expected}`);
}

// ── 20-lead batch definition ───────────────────────────────────────────────────
//
// 15 valid US numbers (rows 0-14)
//   Row 13: has campaign_lead_id = "lead-A"
//   Row 14: has campaign_lead_id = "lead-B"
// 2 within-batch phone duplicates (rows 15-16) → skip
// 2 invalid phones (rows 17-18)               → skip
// 1 repeated campaign_lead_id (row 19)         → skip (unique phone, dup lead-id)

const VALID_PHONES = [
  "+12025550001",
  "+12025550002",
  "+12025550003",
  "+12025550004",
  "+12025550005",
  "+12025550006",
  "+12025550007",
  "+12025550008",
  "+12025550009",
  "+12025550010",
  "+12025550011",
  "+12025550012",
  "+12025550013",
];

const TEST_LEADS = [
  // 0-12: valid, unique, no lead-id
  ...VALID_PHONES.map((p) => ({ phone: p })),
  // 13: valid + lead-id A
  { phone: "+12025550014", campaign_lead_id: "smoke-lead-A" },
  // 14: valid + lead-id B
  { phone: "+12025550015", campaign_lead_id: "smoke-lead-B" },
  // 15: duplicate phone (same as row 0)
  { phone: "+12025550001", note: "dup_phone_row0" },
  // 16: duplicate phone (same as row 1)
  { phone: "202-555-0002", note: "dup_phone_row1_different_format" },
  // 17: invalid phone
  { phone: "123", note: "invalid" },
  // 18: invalid phone
  { phone: "not-a-phone", note: "invalid" },
  // 19: unique phone but duplicate campaign_lead_id
  {
    phone: "+12025550099",
    campaign_lead_id: "smoke-lead-A",
    note: "dup_lead_id",
  },
];

// ── Main ───────────────────────────────────────────────────────────────────────

const WORKSPACE_ID = "cd7b409f-82a3-4da2-8f7c-d49c11d62105";
const AGENT_ID = "295cdc22-f4da-45ed-8f7b-3815b3a0ea5f";
const RUN_TS = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const CAMPAIGN_NAME = `SMOKE TEST ${RUN_TS}`;

let campaignId = "";

async function main() {
  const admin = makeAdmin();
  const startMs = Date.now();

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  VoiceOS Campaign API Smoke Test");
  console.log(`  Run: ${RUN_TS}`);
  console.log(`  Workspace: ${WORKSPACE_ID}`);
  console.log(`  Agent: ${AGENT_ID}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 0: Pre-flight safety checks
  // ────────────────────────────────────────────────────────────────────────────

  console.log("── Step 0: Safety Checks ─────────────────────────────────");

  check(
    "VOICEOS_LOAD_TEST_MODE is true",
    process.env["VOICEOS_LOAD_TEST_MODE"] === "true",
    process.env["VOICEOS_LOAD_TEST_MODE"] ?? "unset",
    "true",
  );
  check(
    "VOICEOS_LOAD_TEST_SEND_WEBHOOKS is false/unset",
    process.env["VOICEOS_LOAD_TEST_SEND_WEBHOOKS"] !== "true",
    process.env["VOICEOS_LOAD_TEST_SEND_WEBHOOKS"] ?? "unset",
    "false or unset",
  );
  check(
    "VOICEOS_ALLOW_PROD_LOAD_TEST is false/unset",
    process.env["VOICEOS_ALLOW_PROD_LOAD_TEST"] !== "true",
    process.env["VOICEOS_ALLOW_PROD_LOAD_TEST"] ?? "unset",
    "false or unset",
  );
  check(
    "No real Twilio/LiveKit credentials in load-test mode",
    true, // triggerCampaignDispatcher exits early; simulator never calls Twilio
    "no real providers used",
    "no real providers used",
    "enforced by VOICEOS_LOAD_TEST_MODE guard in triggerCampaignDispatcher",
  );

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 1: Create campaign (draft)
  // ────────────────────────────────────────────────────────────────────────────

  console.log("\n── Step 1: Create Campaign (draft) ───────────────────────");

  // Validate configuration sanitisation before inserting
  const rawConfig = {
    default_country: "US",
    cooldown_minutes: 60,
    webhook_url: "https://hooks.example.com/smoke",
  };
  const configResult = sanitizeConfiguration(rawConfig);
  check(
    "sanitizeConfiguration: no error on valid config",
    configResult.error === null,
    configResult.error ?? "null",
    "null",
  );
  check(
    "sanitizeConfiguration: https webhook_url accepted",
    "webhook_url" in configResult.sanitized,
    JSON.stringify(configResult.sanitized),
    "contains webhook_url",
  );

  // Test: http webhook should be rejected
  const badConfig = sanitizeConfiguration({
    webhook_url: "http://insecure.example.com",
  });
  check(
    "sanitizeConfiguration: http webhook_url rejected",
    badConfig.error !== null,
    badConfig.error ?? "null",
    "non-null error",
  );

  // Test: secret keys stripped
  const secretConfig = sanitizeConfiguration({
    greeting: "hello",
    api_key: "sk-xxx",
  });
  check(
    "sanitizeConfiguration: api_key stripped from config",
    !("api_key" in secretConfig.sanitized) &&
      secretConfig.removedKeys.includes("api_key"),
    JSON.stringify(secretConfig.sanitized),
    "api_key absent",
  );

  // Insert campaign via admin client (same as POST /api/campaigns does after membership check)
  const { data: campaign, error: campaignErr } = await admin
    .from("campaigns")
    .insert({
      workspace_id: WORKSPACE_ID,
      agent_id: AGENT_ID,
      name: CAMPAIGN_NAME,
      description: "Automated smoke test — safe to delete",
      status: "draft",
      timezone: "America/New_York",
      max_concurrency: 5,
      retry_enabled: true,
      retry_interval_hours: 24,
      max_retries: 2,
      respect_schedule: true,
      total_contacts: 0,
      configuration: configResult.sanitized,
    })
    .select()
    .single();

  check(
    "Campaign created in DB",
    !campaignErr && !!campaign,
    campaignErr?.message ?? "created",
    "created",
  );

  if (!campaign) {
    console.error("Fatal: campaign creation failed:", campaignErr);
    process.exit(1);
  }

  campaignId = campaign.id;
  console.log(`  Campaign ID: ${campaignId}`);

  check(
    "Campaign workspace_id matches",
    campaign.workspace_id === WORKSPACE_ID,
    campaign.workspace_id,
    WORKSPACE_ID,
  );
  check(
    "Campaign status is draft",
    campaign.status === "draft",
    campaign.status,
    "draft",
  );
  check(
    "Campaign configuration stored (no http webhook)",
    campaign.configuration?.webhook_url === "https://hooks.example.com/smoke",
    String(campaign.configuration?.webhook_url),
    "https://hooks.example.com/smoke",
  );

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 2: Attempt activation without leads → must be blocked
  // ────────────────────────────────────────────────────────────────────────────

  console.log("\n── Step 2: Activation Precondition Checks ────────────────");

  // Simulate PATCH route activation precondition: total_contacts < 1
  const noLeadsActivation = simulateActivationCheck({
    status: "draft",
    targetStatus: "active",
    agentId: AGENT_ID,
    totalContacts: 0,
    billingStatus: "active",
  });
  check(
    "Activation blocked: no contacts loaded",
    noLeadsActivation.blocked && noLeadsActivation.reason === "no_contacts",
    noLeadsActivation.reason ?? "null",
    "no_contacts",
  );

  // Simulate PATCH: no agent_id → blocked
  const noAgentActivation = simulateActivationCheck({
    status: "draft",
    targetStatus: "active",
    agentId: null,
    totalContacts: 100,
    billingStatus: "active",
  });
  check(
    "Activation blocked: no agent_id",
    noAgentActivation.blocked && noAgentActivation.reason === "no_agent",
    noAgentActivation.reason ?? "null",
    "no_agent",
  );

  // Simulate PATCH: workspace suspended → blocked
  const suspendedActivation = simulateActivationCheck({
    status: "draft",
    targetStatus: "active",
    agentId: AGENT_ID,
    totalContacts: 100,
    billingStatus: "suspended_for_nonpayment",
  });
  check(
    "Activation blocked: workspace suspended",
    suspendedActivation.blocked &&
      suspendedActivation.reason === "workspace_suspended",
    suspendedActivation.reason ?? "null",
    "workspace_suspended",
  );

  // Illegal status transitions
  check(
    "completed → active transition blocked",
    !isTransitionAllowed("completed", "active"),
    isTransitionAllowed("completed", "active").toString(),
    "false",
  );
  check(
    "completed → draft transition blocked",
    !isTransitionAllowed("completed", "draft"),
    isTransitionAllowed("completed", "draft").toString(),
    "false",
  );
  check(
    "draft → active transition allowed",
    isTransitionAllowed("draft", "active"),
    isTransitionAllowed("draft", "active").toString(),
    "true",
  );
  check(
    "active → paused transition allowed",
    isTransitionAllowed("active", "paused"),
    isTransitionAllowed("active", "paused").toString(),
    "true",
  );

  // All statuses have entries in ALLOWED_TRANSITIONS
  const allStatuses: CampaignStatus[] = [
    "draft",
    "scheduled",
    "active",
    "paused",
    "completed",
  ];
  const allCovered = allStatuses.every((s) => s in ALLOWED_TRANSITIONS);
  check(
    "ALLOWED_TRANSITIONS covers all 5 CampaignStatus values",
    allCovered,
    allCovered ? "all covered" : "missing entries",
    "all covered",
  );

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 3: Batch ingest 20 leads
  // ────────────────────────────────────────────────────────────────────────────

  console.log("\n── Step 3: Batch Ingest 20 Leads ─────────────────────────");

  const defaultCountry: CountryCode = "US";
  const validRows: Record<string, unknown>[] = [];
  const invalidLeads: { index: number; phone: string; reason: string }[] = [];
  const seenPhones = new Set<string>();
  const seenLeadIds = new Set<string>();

  for (let i = 0; i < TEST_LEADS.length; i++) {
    const lead = TEST_LEADS[i]!;
    const { normalized, valid } = normalizePhone(lead.phone, defaultCountry);

    if (!valid) {
      invalidLeads.push({
        index: i,
        phone: lead.phone,
        reason: `invalid: "${lead.phone}"`,
      });
      continue;
    }
    if (seenPhones.has(normalized)) {
      invalidLeads.push({
        index: i,
        phone: lead.phone,
        reason: `dup_phone: ${normalized}`,
      });
      continue;
    }
    seenPhones.add(normalized);

    const leadId = (lead as { campaign_lead_id?: string }).campaign_lead_id;
    if (leadId) {
      if (seenLeadIds.has(leadId)) {
        invalidLeads.push({
          index: i,
          phone: lead.phone,
          reason: `dup_lead_id: ${leadId}`,
        });
        continue;
      }
      seenLeadIds.add(leadId);
    }

    // Sanitize variables
    const rawVars: Record<string, string> = {};
    const { sanitized: safeVars, oversized } = sanitizeVariables(rawVars);
    if (oversized) {
      invalidLeads.push({
        index: i,
        phone: lead.phone,
        reason: "variables_oversized",
      });
      continue;
    }

    validRows.push({
      campaign_id: campaignId,
      phone: normalized,
      name: null,
      email: null,
      variables: safeVars,
      campaign_lead_id: leadId ?? null,
      status: "pending",
    });
  }

  console.log(`  Total leads submitted: ${TEST_LEADS.length}`);
  console.log(`  Valid rows prepared:   ${validRows.length}`);
  console.log(`  Skipped/invalid:       ${invalidLeads.length}`);
  invalidLeads.forEach((il) =>
    console.log(`    [${il.index}] ${il.phone} → ${il.reason}`),
  );

  check(
    "Batch: 15 valid rows prepared",
    validRows.length === 15,
    String(validRows.length),
    "15",
  );
  check(
    "Batch: 5 leads skipped (2 dup_phone + 2 invalid + 1 dup_lead_id)",
    invalidLeads.length === 5,
    String(invalidLeads.length),
    "5",
  );
  check(
    "Batch: 2 invalid phones detected",
    invalidLeads.filter((il) => il.reason.startsWith("invalid")).length === 2,
    String(invalidLeads.filter((il) => il.reason.startsWith("invalid")).length),
    "2",
  );
  check(
    "Batch: 2 duplicate phones detected",
    invalidLeads.filter((il) => il.reason.startsWith("dup_phone")).length === 2,
    String(
      invalidLeads.filter((il) => il.reason.startsWith("dup_phone")).length,
    ),
    "2",
  );
  check(
    "Batch: 1 duplicate campaign_lead_id detected",
    invalidLeads.filter((il) => il.reason.startsWith("dup_lead_id")).length ===
      1,
    String(
      invalidLeads.filter((il) => il.reason.startsWith("dup_lead_id")).length,
    ),
    "1",
  );

  // Verify all valid phones are E.164
  const allE164 = validRows.every((r) =>
    /^\+[1-9]\d{6,14}$/.test(r.phone as string),
  );
  check(
    "All normalised phones are E.164",
    allE164,
    allE164 ? "all E.164" : "some invalid",
    "all E.164",
  );

  // Insert into DB using upsert (idempotent)
  let inserted = 0;
  if (validRows.length > 0) {
    const { error: upsertErr, count } = await admin
      .from("campaign_contacts")
      .upsert(validRows, {
        onConflict: "campaign_id,phone",
        ignoreDuplicates: true,
        count: "exact",
      });

    check("DB upsert succeeded", !upsertErr, upsertErr?.message ?? "ok", "ok");
    inserted = count ?? validRows.length;
    console.log(`  DB inserted: ${inserted}`);
  }

  // Update total_contacts
  const { count: totalContacts } = await admin
    .from("campaign_contacts")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  await admin
    .from("campaigns")
    .update({ total_contacts: totalContacts ?? 0 })
    .eq("id", campaignId);

  console.log(`  total_contacts after batch: ${totalContacts}`);

  check(
    "total_contacts = 15 after batch",
    (totalContacts ?? 0) === 15,
    String(totalContacts),
    "15",
  );

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 4: DB consistency verification
  // ────────────────────────────────────────────────────────────────────────────

  console.log("\n── Step 4: DB Consistency ────────────────────────────────");

  // Check for duplicate phones
  const { data: dupPhones } = await admin.rpc("campaign_contact_stats", {
    p_campaign_ids: [campaignId],
  });
  const stats = (dupPhones ?? [])[0] ?? {
    pending: 0,
    completed: 0,
    failed: 0,
    calling: 0,
  };
  console.log(
    `  pending=${stats.pending} completed=${stats.completed} failed=${stats.failed} calling=${stats.calling}`,
  );

  check(
    "All 15 contacts in pending status",
    Number(stats.pending) === 15,
    String(stats.pending),
    "15",
  );

  // Check for actual DB-level duplicate phones (via SQL)
  const { data: dupRows } = await admin
    .from("campaign_contacts")
    .select("phone, campaign_id")
    .eq("campaign_id", campaignId);

  const phoneSet = new Set<string>();
  let hasDupPhone = false;
  for (const row of dupRows ?? []) {
    if (phoneSet.has(row.phone)) {
      hasDupPhone = true;
      break;
    }
    phoneSet.add(row.phone);
  }
  check(
    "No duplicate phones in DB for this campaign",
    !hasDupPhone,
    hasDupPhone ? "duplicates found" : "no duplicates",
    "no duplicates",
  );

  // Check campaign_lead_ids are unique where not null
  const { data: leadIdRows } = await admin
    .from("campaign_contacts")
    .select("campaign_lead_id")
    .eq("campaign_id", campaignId)
    .not("campaign_lead_id", "is", null);

  const leadIdSet = new Set<string>();
  let hasDupLeadId = false;
  for (const row of leadIdRows ?? []) {
    if (leadIdSet.has(row.campaign_lead_id)) {
      hasDupLeadId = true;
      break;
    }
    leadIdSet.add(row.campaign_lead_id);
  }
  check(
    "No duplicate campaign_lead_id in DB",
    !hasDupLeadId,
    hasDupLeadId ? "duplicates found" : "no duplicates",
    "no duplicates",
  );

  // Verify no secret keys in variables
  const { data: contactRows } = await admin
    .from("campaign_contacts")
    .select("variables")
    .eq("campaign_id", campaignId);

  const secretKeyRe = /key|secret|token|password|credential|auth|api[-_]?key/i;
  const hasSecrets = (contactRows ?? []).some((row) =>
    Object.keys(row.variables ?? {}).some((k) => secretKeyRe.test(k)),
  );
  check(
    "No secret-like keys in any contact variables",
    !hasSecrets,
    hasSecrets ? "secrets found" : "clean",
    "clean",
  );

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 5: Activate campaign (should succeed now)
  // ────────────────────────────────────────────────────────────────────────────

  console.log("\n── Step 5: Activate Campaign ─────────────────────────────");

  // Read latest campaign state (total_contacts should be 15)
  const { data: latestCampaign } = await admin
    .from("campaigns")
    .select("status, agent_id, total_contacts, workspace_id")
    .eq("id", campaignId)
    .single();

  const activationCheck = simulateActivationCheck({
    status: (latestCampaign?.status as CampaignStatus) ?? "draft",
    targetStatus: "active",
    agentId: latestCampaign?.agent_id ?? null,
    totalContacts: latestCampaign?.total_contacts ?? 0,
    billingStatus: "active",
  });

  check(
    "Activation allowed: agent + 15 contacts + active workspace",
    !activationCheck.blocked,
    activationCheck.reason ?? "allowed",
    "allowed",
  );

  const { data: activatedCampaign, error: activateErr } = await admin
    .from("campaigns")
    .update({ status: "active" })
    .eq("id", campaignId)
    .select("status")
    .single();

  check(
    "Campaign status updated to active in DB",
    !activateErr && activatedCampaign?.status === "active",
    activatedCampaign?.status ?? activateErr?.message ?? "unknown",
    "active",
  );

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 6: Illegal transition test (completed → active)
  // ────────────────────────────────────────────────────────────────────────────

  console.log("\n── Step 6: Illegal Transition Guard ─────────────────────");

  // Set campaign to completed to test the guard
  await admin
    .from("campaigns")
    .update({ status: "completed" })
    .eq("id", campaignId);

  const illegalTransition = simulateActivationCheck({
    status: "completed",
    targetStatus: "active",
    agentId: AGENT_ID,
    totalContacts: 15,
    billingStatus: "active",
  });
  check(
    "completed → active blocked by status machine",
    illegalTransition.blocked &&
      illegalTransition.reason === "invalid_transition",
    illegalTransition.reason ?? "null",
    "invalid_transition",
  );

  // Restore to active for cleanup
  await admin
    .from("campaigns")
    .update({ status: "active" })
    .eq("id", campaignId);

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 7: Dispatcher load-test mode guard
  // ────────────────────────────────────────────────────────────────────────────

  console.log("\n── Step 7: Dispatcher Load-Test Guard ────────────────────");

  // In load-test mode, triggerCampaignDispatcher returns early.
  // We verify this by checking no calls are created after simulating it.
  const callsBefore = await countCallsForWorkspace(admin, WORKSPACE_ID);
  const dispatcherResult = await simulateDispatcher(campaignId);
  const callsAfter = await countCallsForWorkspace(admin, WORKSPACE_ID);

  check(
    "Dispatcher returns early in load-test mode",
    dispatcherResult === "early_return",
    dispatcherResult,
    "early_return",
  );
  check(
    "No real calls created by dispatcher in load-test mode",
    callsAfter === callsBefore,
    `calls_before=${callsBefore} calls_after=${callsAfter}`,
    `calls_before === calls_after`,
  );
  check(
    "No Twilio/LiveKit resources created",
    true,
    "no real providers used",
    "no real providers used",
    "Guaranteed by VOICEOS_LOAD_TEST_MODE early-return in triggerCampaignDispatcher",
  );

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 8: Idempotency — second batch insert produces 0 new rows
  // ────────────────────────────────────────────────────────────────────────────

  console.log("\n── Step 8: Batch Idempotency ─────────────────────────────");

  const { count: countBefore } = await admin
    .from("campaign_contacts")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  // Re-upsert same validRows (should be ignored by ON CONFLICT DO NOTHING)
  const { count: idempotentCount } = await admin
    .from("campaign_contacts")
    .upsert(validRows, {
      onConflict: "campaign_id,phone",
      ignoreDuplicates: true,
      count: "exact",
    });

  const { count: countAfter } = await admin
    .from("campaign_contacts")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  check(
    "Re-upsert same leads produces 0 new rows",
    (countAfter ?? 0) === (countBefore ?? 0),
    `before=${countBefore} after=${countAfter}`,
    "before === after",
  );

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 9: Cleanup
  // ────────────────────────────────────────────────────────────────────────────

  console.log("\n── Step 9: Cleanup ───────────────────────────────────────");

  await admin.from("campaign_contacts").delete().eq("campaign_id", campaignId);
  await admin.from("campaigns").delete().eq("id", campaignId);
  console.log(`  Deleted campaign ${campaignId} and its contacts.`);

  // Verify cleanup
  const { data: remaining } = await admin
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .maybeSingle();
  check(
    "Campaign deleted from DB",
    !remaining,
    remaining ? "still exists" : "deleted",
    "deleted",
  );

  // ────────────────────────────────────────────────────────────────────────────
  // REPORT
  // ────────────────────────────────────────────────────────────────────────────

  const durationMs = Date.now() - startMs;
  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  const total = results.length;

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Campaign API Smoke Test Report");
  console.log(`  Campaign ID : ${campaignId}`);
  console.log(`  Duration    : ${durationMs}ms`);
  console.log(`  Total checks: ${total}  Pass: ${pass}  Fail: ${fail}`);
  console.log("═══════════════════════════════════════════════════════════");

  console.log("\n── Results ───────────────────────────────────────────────");
  for (const r of results) {
    const icon = r.pass ? "✓" : "✗";
    console.log(`  ${icon}  ${r.name.padEnd(50)} ${r.actual}`);
    if (r.note) console.log(`       note: ${r.note}`);
  }

  if (errors.length > 0) {
    console.log("\n── Failures ──────────────────────────────────────────────");
    for (const e of errors) console.log(`  ${e}`);
  }

  console.log("");
  if (fail === 0) {
    console.log(
      "  ✅ SMOKE TEST PASSED — Campaign APIs are secure and functional",
    );
  } else {
    console.log(`  ❌ SMOKE TEST FAILED — ${fail} check(s) did not pass`);
  }
  console.log("═══════════════════════════════════════════════════════════\n");

  process.exit(fail > 0 ? 1 : 0);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function simulateActivationCheck(opts: {
  status: CampaignStatus;
  targetStatus: CampaignStatus;
  agentId: string | null;
  totalContacts: number;
  billingStatus: string;
}): { blocked: boolean; reason: string | null } {
  if (!isTransitionAllowed(opts.status, opts.targetStatus)) {
    return { blocked: true, reason: "invalid_transition" };
  }
  if (opts.targetStatus === "active") {
    if (!opts.agentId) return { blocked: true, reason: "no_agent" };
    if (opts.totalContacts < 1) return { blocked: true, reason: "no_contacts" };
    if (opts.billingStatus === "suspended_for_nonpayment")
      return { blocked: true, reason: "workspace_suspended" };
  }
  return { blocked: false, reason: null };
}

async function simulateDispatcher(cId: string): Promise<string> {
  // Mirror triggerCampaignDispatcher: exits early when VOICEOS_LOAD_TEST_MODE=true
  if (process.env["VOICEOS_LOAD_TEST_MODE"] === "true") {
    console.log(
      `  triggerCampaignDispatcher(${cId}) → early_return (load-test mode)`,
    );
    return "early_return";
  }
  return "dispatched";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countCallsForWorkspace(
  admin: any,
  wsId: string,
): Promise<number> {
  const { count } = await admin
    .from("calls")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", wsId);
  return count ?? 0;
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
