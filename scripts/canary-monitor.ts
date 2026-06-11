/**
 * Canary Call #1 — real-time monitor
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

const CAMPAIGN_ID = "be89baba-d6bd-4e83-8151-ce5127e6fda7";
const CONTACT_ID = "829b4c7f-0c8d-42a9-a58d-19a7d69e77bf";
const WS_ID = "cd7b409f-82a3-4da2-8f7c-d49c11d62105";

function ts() { return new Date().toISOString().slice(11,23); }

async function getCall() {
  return admin
    .from("calls")
    .select("id,retell_call_id,technical_status,business_outcome,duration_seconds,answered_at,ended_at,routing_data,cost_usd,contact_phone,created_at")
    .eq("campaign_id", CAMPAIGN_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
}

async function getContact() {
  return admin
    .from("campaign_contacts")
    .select("id,status,attempts,last_called_at,call_id")
    .eq("id", CONTACT_ID)
    .single();
}

async function main() {
  console.log(`[${ts()}] Starting monitor for campaign ${CAMPAIGN_ID}`);

  // Wait for call record to appear (up to 30s)
  let callId: string | null = null;
  let roomName: string | null = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const { data: c } = await getCall();
    if (c?.id) {
      callId = c.id;
      roomName = c.retell_call_id;
      console.log(`[${ts()}] ✅ Call record found: id=${callId} room=${roomName} status=${c.technical_status} routing=${JSON.stringify(c.routing_data)}`);
      break;
    }
    if (i % 5 === 0) console.log(`[${ts()}] Waiting for call record... (${i*2}s)`);
  }

  if (!callId) {
    console.error(`[${ts()}] ❌ No call record found after 60s`);

    // Check contact status anyway
    const { data: contact } = await getContact();
    console.log(`[${ts()}] Contact status:`, contact);

    // Check workspace active_calls
    const { data: ws } = await admin
      .from("workspaces")
      .select("active_calls")
      .eq("id", WS_ID)
      .single();
    console.log(`[${ts()}] Workspace active_calls:`, ws?.active_calls);

    process.exit(1);
  }

  // Monitor call until it ends (up to 5 min)
  console.log(`\n[${ts()}] Monitoring call ${callId}...`);
  let lastStatus = "";
  let callEnded = false;

  for (let i = 0; i < 150; i++) {
    await new Promise(r => setTimeout(r, 2000));

    const { data: call } = await getCall();
    if (!call) continue;

    const status = `${call.technical_status}/${call.business_outcome ?? "—"}`;
    if (status !== lastStatus) {
      console.log(`[${ts()}] 📞 Status: ${status} | answered=${call.answered_at ?? "no"} | ended=${call.ended_at ?? "no"} | duration=${call.duration_seconds ?? 0}s | cost=$${call.cost_usd ?? 0}`);
      lastStatus = status;
    }

    if (call.technical_status === "in_progress" && !call.answered_at) {
      console.log(`[${ts()}] 📡 Ringing...`);
    }

    if (call.ended_at) {
      callEnded = true;
      console.log(`\n[${ts()}] 📴 CALL ENDED`);
      console.log("Final call record:", JSON.stringify(call, null, 2));
      break;
    }

    // Check for events every 10s
    if (i % 5 === 0 && roomName) {
      const { data: events } = await admin
        .from("call_events")
        .select("event_type,payload,created_at")
        .eq("call_room", roomName)
        .order("created_at", { ascending: true });
      if (events?.length) {
        console.log(`[${ts()}] 📋 Events (${events.length}): ${events.map(e => e.event_type).join(", ")}`);
      }
    }
  }

  if (!callEnded) {
    console.log(`[${ts()}] ⏰ Monitor timeout (5 min) — call still active`);
  }

  // ── POST-CALL MONITORING ─────────────────────────────────────
  console.log(`\n[${ts()}] Checking post-call state...`);

  // Contact status
  const { data: contact } = await getContact();
  console.log(`\n[${ts()}] Contact:`, contact);

  // Campaign status
  const { data: camp } = await admin
    .from("campaigns")
    .select("status,completed_contacts,total_contacts")
    .eq("id", CAMPAIGN_ID)
    .single();
  console.log(`[${ts()}] Campaign:`, camp);

  // Workspace active_calls
  const { data: ws } = await admin
    .from("workspaces")
    .select("active_calls,minutes_used")
    .eq("id", WS_ID)
    .single();
  console.log(`[${ts()}] Workspace active_calls=${ws?.active_calls} minutes_used=${ws?.minutes_used}`);

  if (!callId) return;

  // Post-call jobs (wait up to 2 min for worker to process)
  console.log(`\n[${ts()}] Waiting for post_call_jobs...`);
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const { data: jobs } = await admin
      .from("post_call_jobs")
      .select("job_type,status,attempts,error_message,completed_at")
      .eq("call_id", callId)
      .order("created_at", { ascending: true });

    if (jobs?.length) {
      const summary = jobs.map(j => `${j.job_type}:${j.status}`).join(", ");
      const pending = jobs.filter(j => !["completed","dead_letter","canceled"].includes(j.status)).length;
      console.log(`[${ts()}] Jobs (${jobs.length}): ${summary}`);
      if (pending === 0) {
        console.log(`[${ts()}] ✅ All post_call_jobs completed`);
        console.log("Jobs detail:", JSON.stringify(jobs, null, 2));
        break;
      }
    } else if (i % 4 === 0) {
      console.log(`[${ts()}] Waiting for post_call_jobs... (${i*5}s)`);
    }
  }

  // Call events summary
  if (roomName) {
    const { data: events } = await admin
      .from("call_events")
      .select("event_type,payload,created_at")
      .eq("call_room", roomName)
      .order("created_at", { ascending: true });
    console.log(`\n[${ts()}] All call_events (${events?.length ?? 0}):`);
    events?.forEach(e => console.log(`  ${e.created_at.slice(11,23)} ${e.event_type}`, JSON.stringify(e.payload).slice(0,100)));
  }

  // Provider health last snapshot
  const { data: health } = await admin
    .from("provider_health_snapshots")
    .select("provider,success_rate,avg_latency_ms,snapshot_at")
    .order("snapshot_at", { ascending: false })
    .limit(5);
  console.log(`\n[${ts()}] Provider health:`, health);

  console.log(`\n[${ts()}] ✅ Canary Call #1 monitoring complete`);
}

main().catch(console.error);
