/**
 * Canary Call #1 — diagnostic snapshot
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const admin = createClient(
  process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  { auth: { persistSession: false } },
);

const CALL_ID = "da1fd213-3465-475f-9836-c2755a66c11e";
const ROOM_NAME = "agent-295cdc22-f4da-45ed-8f7b-3815b3a0ea5f-1781184265454";
const CAMPAIGN_ID = "be89baba-d6bd-4e83-8151-ce5127e6fda7";
const WS_ID = "cd7b409f-82a3-4da2-8f7c-d49c11d62105";
const TWILIO_SID = "CAfa2d696eb5857bdfee1bc40cf3307437";

async function main() {
  console.log("=== CANARY CALL #1 DIAGNOSTIC ===\n");

  // Full call record
  const { data: call } = await admin
    .from("calls")
    .select("*")
    .eq("id", CALL_ID)
    .single();
  console.log("CALL RECORD:");
  console.log(JSON.stringify(call, null, 2));

  // Contact status
  const { data: contact } = await admin
    .from("campaign_contacts")
    .select("*")
    .eq("campaign_id", CAMPAIGN_ID)
    .single();
  console.log("\nCONTACT:", JSON.stringify(contact, null, 2));

  // Campaign
  const { data: camp } = await admin
    .from("campaigns")
    .select("id,status,total_contacts,completed_contacts,active_calls")
    .eq("id", CAMPAIGN_ID)
    .single();
  console.log("\nCAMPAIGN:", JSON.stringify(camp, null, 2));

  // Workspace
  const { data: ws } = await admin
    .from("workspaces")
    .select("active_calls,minutes_used,last_call_claimed_at")
    .eq("id", WS_ID)
    .single();
  console.log("\nWORKSPACE:", JSON.stringify(ws, null, 2));

  // Call events
  const { data: events } = await admin
    .from("call_events")
    .select("*")
    .eq("call_room", ROOM_NAME)
    .order("created_at", { ascending: true });
  console.log(`\nCALL EVENTS (${events?.length ?? 0}):`);
  events?.forEach(e => console.log(` ${e.created_at.slice(11,19)} ${e.event_type} ${JSON.stringify(e.payload).slice(0,150)}`));

  // Post-call jobs
  const { data: jobs } = await admin
    .from("post_call_jobs")
    .select("*")
    .eq("call_id", CALL_ID);
  console.log(`\nPOST_CALL_JOBS (${jobs?.length ?? 0}):`);
  jobs?.forEach(j => console.log(` ${j.job_type} ${j.status} attempts=${j.attempts} err=${j.error_message ?? "none"}`));

  // Dial eligibility check for this call
  const { data: eligChecks } = await admin
    .from("dial_eligibility_checks")
    .select("*")
    .eq("campaign_id", CAMPAIGN_ID)
    .order("created_at", { ascending: false })
    .limit(3);
  console.log(`\nDIAL ELIGIBILITY CHECKS (${eligChecks?.length ?? 0}):`);
  eligChecks?.forEach(c => console.log(` ${c.created_at?.slice(11,19)} allowed=${c.allowed} reason=${c.reason ?? "ok"} code=${c.reason_code ?? "—"}`));

  // Twilio status via REST
  const twilioSid = process.env["TWILIO_ACCOUNT_SID"]!;
  const twilioAuth = process.env["TWILIO_AUTH_TOKEN"]!;
  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls/${TWILIO_SID}.json`,
    { headers: { Authorization: "Basic " + Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64") } }
  );
  const twilioData = await twilioRes.json() as Record<string, unknown>;
  console.log("\nTWILIO CALL STATUS:");
  console.log(` sid=${twilioData["sid"]} status=${twilioData["status"]} direction=${twilioData["direction"]}`);
  console.log(` duration=${twilioData["duration"]}s to=${twilioData["to"]} from=${twilioData["from"]}`);
  console.log(` answered_by=${twilioData["answered_by"] ?? "—"}`);
  if (twilioData["subresource_uris"]) {
    console.log(` price=${twilioData["price"] ?? "—"} price_unit=${twilioData["price_unit"] ?? "—"}`);
  }
  console.log(`\nFull Twilio:`, JSON.stringify({
    status: twilioData["status"],
    direction: twilioData["direction"],
    duration: twilioData["duration"],
    to: twilioData["to"],
    from: twilioData["from"],
    answered_by: twilioData["answered_by"],
    price: twilioData["price"],
    error_code: twilioData["error_code"],
    error_message: twilioData["error_message"],
    start_time: twilioData["start_time"],
    end_time: twilioData["end_time"],
    date_created: twilioData["date_created"],
    forwarded_from: twilioData["forwarded_from"],
  }, null, 2));
}

main().catch(console.error);
