/**
 * Canary Call #1 — creates a 1-contact campaign and triggers dial
 * Credentials sourced from process.env only — never in CLI args
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
const SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
const INTERNAL_SECRET = process.env["INTERNAL_API_SECRET"]!;
const VERCEL_URL = "https://nextjs-commerce-git-claude-voic-6cb608-marios-projects-0d440ccd.vercel.app";

const AGENT_ID = "295cdc22-f4da-45ed-8f7b-3815b3a0ea5f";
const WS_ID = "cd7b409f-82a3-4da2-8f7c-d49c11d62105";
const PHONE = "+18099052406";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function section(title: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`=== ${title}`);
  console.log("=".repeat(60));
}

function ok(label: string, data: unknown) {
  console.log(`✅ ${label}:`, JSON.stringify(data, null, 2));
}

function fail(label: string, err: unknown) {
  console.error(`❌ ${label}:`, err);
}

async function run() {
  // ── PRE-DIAL COMPLIANCE ───────────────────────────────────────
  section("PRE-DIAL COMPLIANCE CHECK");

  const { data: ws, error: wsErr } = await admin
    .from("workspaces")
    .select("id,name,minutes_used,minutes_limit,is_suspended,billing_status")
    .eq("id", WS_ID)
    .single();
  if (wsErr) { fail("workspace", wsErr); process.exit(1); }
  ok("workspace", ws);

  if (ws!.is_suspended) {
    console.error("❌ Workspace is suspended — aborting");
    process.exit(1);
  }
  if ((ws!.minutes_used ?? 0) >= (ws!.minutes_limit ?? Infinity)) {
    console.error("❌ Workspace minutes exhausted — aborting");
    process.exit(1);
  }

  const { data: dnc } = await admin
    .from("dnc_list")
    .select("phone")
    .eq("workspace_id", WS_ID)
    .eq("phone", PHONE);
  ok("dnc_list", dnc?.length ? "BLOCKED" : "clear");
  if (dnc?.length) { console.error("❌ Number in DNC — aborting"); process.exit(1); }

  const { data: optOuts } = await admin
    .from("calls")
    .select("id,business_outcome")
    .eq("workspace_id", WS_ID)
    .eq("contact_phone", PHONE)
    .in("business_outcome", ["dnc", "opt_out"]);
  ok("opt_out_check", optOuts?.length ? "BLOCKED" : "clear");
  if (optOuts?.length) { console.error("❌ Previous opt-out — aborting"); process.exit(1); }

  const { data: compSettings } = await admin
    .from("compliance_settings")
    .select("*")
    .eq("workspace_id", WS_ID);
  ok("compliance_settings", compSettings?.length ? compSettings : "none (hours check DISABLED)");

  console.log("\n✅ PRE-DIAL COMPLIANCE: ALL CLEAR");

  // ── CREATE CAMPAIGN ───────────────────────────────────────────
  section("CREATE CANARY CAMPAIGN");

  const campaignName = `Canary-Call-1-${new Date().toISOString().slice(0,19).replace(/[T:]/g, "-")}`;
  const { data: campaign, error: campErr } = await admin
    .from("campaigns")
    .insert({
      workspace_id: WS_ID,
      agent_id: AGENT_ID,
      name: campaignName,
      status: "draft",
      max_concurrency: 1,
      retry_enabled: false,
      max_retries: 0,
      timezone: "America/Santo_Domingo",
    })
    .select()
    .single();

  if (campErr) { fail("create_campaign", campErr); process.exit(1); }
  ok("campaign", campaign);
  const campaignId = campaign!.id as string;

  // ── ADD CONTACT ───────────────────────────────────────────────
  section("ADD CONTACT");

  const { data: contact, error: contactErr } = await admin
    .from("campaign_contacts")
    .insert({
      campaign_id: campaignId,
      phone: PHONE,
      name: "Canary-Contact-1",
      status: "pending",
    })
    .select()
    .single();

  if (contactErr) { fail("add_contact", contactErr); process.exit(1); }
  ok("contact", contact);
  const contactId = contact!.id as string;

  // ── ACTIVATE CAMPAIGN ─────────────────────────────────────────
  section("ACTIVATE CAMPAIGN");

  const { data: activated, error: activateErr } = await admin
    .from("campaigns")
    .update({ status: "active" })
    .eq("id", campaignId)
    .select()
    .single();

  if (activateErr) { fail("activate_campaign", activateErr); process.exit(1); }
  ok("campaign_status", activated!.status);

  // ── TRIGGER CRON DIAL ─────────────────────────────────────────
  section("TRIGGER CAMPAIGN DIAL");

  const cronRes = await fetch(`${VERCEL_URL}/api/cron/campaign-dial`, {
    headers: {
      Authorization: `Bearer ${INTERNAL_SECRET}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(55_000),
  });

  const cronBody = await cronRes.text();
  if (!cronRes.ok) {
    fail("cron_dial", `HTTP ${cronRes.status}: ${cronBody.slice(0, 200)}`);
    process.exit(1);
  }

  let cronJson: unknown;
  try { cronJson = JSON.parse(cronBody); } catch { cronJson = cronBody; }
  ok("cron_dial_response", cronJson);

  // ── OUTPUT IDs FOR MONITORING ─────────────────────────────────
  section("CALL SETUP COMPLETE — IDs FOR MONITORING");
  console.log(`campaign_id: ${campaignId}`);
  console.log(`contact_id:  ${contactId}`);
  console.log(`phone:       ${PHONE}`);
  console.log(`agent_id:    ${AGENT_ID}`);
  console.log(`workspace_id:${WS_ID}`);
}

run().catch((e) => { console.error("FATAL:", e); process.exit(1); });
