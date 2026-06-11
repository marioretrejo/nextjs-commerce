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
const WS_ID = "cd7b409f-82a3-4da2-8f7c-d49c11d62105";

async function main() {
  // Full call record verification
  const { data: call } = await admin
    .from("calls")
    .select("id,technical_status,business_outcome,ended_at,end_reason,duration_seconds,routing_data")
    .eq("id", CALL_ID)
    .single();
  console.log("calls record:", JSON.stringify(call, null, 2));

  // Workspace slot
  const { data: ws } = await admin
    .from("workspaces")
    .select("active_calls,minutes_used")
    .eq("id", WS_ID)
    .single();
  console.log("workspace active_calls:", ws?.active_calls, "(expected: 0)");

  // Contact
  const { data: contacts } = await admin
    .from("campaign_contacts")
    .select("id,status,attempts")
    .eq("campaign_id", CAMPAIGN_ID);
  console.log("contacts:", contacts);

  // No post_call_jobs for this call
  const { data: jobs } = await admin
    .from("post_call_jobs")
    .select("id,job_type,status")
    .eq("call_id", CALL_ID);
  console.log("post_call_jobs:", jobs?.length ?? 0, "jobs (expected: 0)");

  // No duplicate jobs by room_name
  const ROOM_NAME = "agent-295cdc22-f4da-45ed-8f7b-3815b3a0ea5f-1781184265454";
  const { data: roomJobs } = await admin
    .from("post_call_jobs")
    .select("id,job_type,status")
    .eq("room_name", ROOM_NAME);
  console.log("post_call_jobs by room:", roomJobs?.length ?? 0, "jobs (expected: 0)");
}

main().catch(console.error);
