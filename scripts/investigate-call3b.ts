import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const admin = createClient(
  process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  { auth: { persistSession: false } },
);

const CALL_ID = "7e929400-964c-40c2-9908-ec9e413ddd64";
const WS_ID = "cd7b409f-82a3-4da2-8f7c-d49c11d62105";

async function main() {
  // 1. Final call record state
  const { data: call } = await admin
    .from("calls")
    .select("id,technical_status,business_outcome,status,ended_at,answered_at,duration_seconds,end_reason,retell_call_id,routing_data,cost_usd")
    .eq("id", CALL_ID).single();
  console.log("=== CALL RECORD ===");
  console.log(JSON.stringify(call, null, 2));

  // 2. Workspace active_calls
  const { data: ws } = await admin.from("workspaces").select("active_calls").eq("id", WS_ID).single();
  console.log("\nactive_calls:", ws?.active_calls);

  // 3. Call events
  const roomName = (call as {retell_call_id:string|null} | null)?.retell_call_id;
  if (roomName) {
    const { data: events } = await admin.from("call_events")
      .select("event_type,created_at,payload")
      .eq("call_room", roomName)
      .order("created_at", { ascending: true });
    console.log(`\n=== CALL EVENTS (${events?.length ?? 0}) ===`);
    (events ?? []).forEach((e: {event_type:string;created_at:string;payload:unknown}) =>
      console.log(`  ${e.created_at.slice(11,23)} ${e.event_type} ${JSON.stringify(e.payload ?? {}).slice(0,150)}`));
  } else {
    console.log("\nNo room name — searching events by call_id if available");
    // Try call_id column
    const { data: eventsByCallId } = await admin.from("call_events")
      .select("event_type,created_at,payload")
      .eq("call_id", CALL_ID)
      .order("created_at", { ascending: true });
    console.log(`Events by call_id: ${eventsByCallId?.length ?? 0}`);
    (eventsByCallId ?? []).forEach((e: {event_type:string;created_at:string;payload:unknown}) =>
      console.log(`  ${e.created_at.slice(11,23)} ${e.event_type} ${JSON.stringify(e.payload ?? {}).slice(0,150)}`));
  }

  // 4. Post-call jobs
  const { data: jobs } = await admin.from("post_call_jobs")
    .select("job_type,status,error_message")
    .eq("call_id", CALL_ID);
  console.log(`\n=== POST-CALL JOBS (${jobs?.length ?? 0}) ===`);
  (jobs ?? []).forEach((j: {job_type:string;status:string;error_message:string|null}) =>
    console.log(`  ${j.job_type}: ${j.status} ${j.error_message ? `— ${j.error_message}` : ""}`));

  // 5. Campaign contact state
  const { data: contact } = await admin.from("campaign_contacts")
    .select("status,attempts")
    .eq("campaign_id", "7663705c-08fd-4d07-9b3e-10ceb12d46f1")
    .limit(1).single();
  console.log("\nContact status:", contact?.status, "attempts:", contact?.attempts);
}

main().catch(e => { console.error(e); process.exit(1); });
