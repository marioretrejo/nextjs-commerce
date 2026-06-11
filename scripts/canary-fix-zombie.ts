/**
 * Fix zombie state from Canary Call #1 no-answer
 * Manually applies the state that the Twilio webhook should have applied
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
const CAMPAIGN_ID = "be89baba-d6bd-4e83-8151-ce5127e6fda7";
const CONTACT_ID = "829b4c7f-0c8d-42a9-a58d-19a7d69e77bf";
const WS_ID = "cd7b409f-82a3-4da2-8f7c-d49c11d62105";

// Twilio confirmed: no-answer at 2026-06-11T13:24:51Z, duration=0
const TWILIO_ENDED_AT = "2026-06-11T13:24:51.000Z";

async function main() {
  console.log("=== Fixing Canary Call #1 zombie state ===\n");

  // 1. Update call record with actual outcome
  const { error: callErr } = await admin
    .from("calls")
    .update({
      technical_status: "no_answer",
      ended_at: TWILIO_ENDED_AT,
      duration_seconds: 0,
      end_reason: "twilio_no_answer",
    })
    .eq("id", CALL_ID);
  console.log("call update:", callErr ? callErr.message : "✅ ok (technical_status=no_answer)");

  // 2. Update contact status
  const { error: contactErr } = await admin
    .from("campaign_contacts")
    .update({ status: "no_answer" })
    .eq("id", CONTACT_ID);
  console.log("contact update:", contactErr ? contactErr.message : "✅ ok (status=no_answer)");

  // 3. Release workspace active_calls slot via RPC (prefer RPC, fallback to direct)
  const { error: rpcErr } = await admin.rpc("release_call_slot", {
    p_workspace_id: WS_ID,
  });
  if (rpcErr) {
    console.log("release_call_slot RPC:", rpcErr.message, "— trying direct update...");
    // Direct update as fallback
    const { error: wsErr } = await admin
      .from("workspaces")
      .update({ active_calls: 0 })
      .eq("id", WS_ID);
    console.log("workspace direct update:", wsErr ? wsErr.message : "✅ ok (active_calls=0)");
  } else {
    console.log("release_call_slot RPC: ✅ ok");
  }

  // 4. Mark campaign as completed (single contact, no retries)
  const { error: campErr } = await admin
    .from("campaigns")
    .update({ status: "completed" })
    .eq("id", CAMPAIGN_ID);
  console.log("campaign update:", campErr ? campErr.message : "✅ ok (status=completed)");

  // Verify final state
  console.log("\n=== Verification ===");
  const { data: call } = await admin.from("calls").select("technical_status,business_outcome,ended_at,duration_seconds").eq("id", CALL_ID).single();
  console.log("call:", call);

  const { data: ws } = await admin.from("workspaces").select("active_calls,minutes_used").eq("id", WS_ID).single();
  console.log("workspace:", ws);

  const { data: contact } = await admin.from("campaign_contacts").select("status,attempts").eq("id", CONTACT_ID).single();
  console.log("contact:", contact);
}

main().catch(console.error);
