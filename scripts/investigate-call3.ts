import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const admin = createClient(
  process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  { auth: { persistSession: false } },
);
const WS_ID = "cd7b409f-82a3-4da2-8f7c-d49c11d62105";
const CAMPAIGN_ID = "7663705c-08fd-4d07-9b3e-10ceb12d46f1";

async function main() {
  const { data: ws } = await admin.from("workspaces").select("active_calls").eq("id", WS_ID).single();
  console.log("active_calls:", ws?.active_calls);

  const { data: campCalls } = await admin.from("calls")
    .select("id,technical_status,ended_at,routing_data,created_at")
    .eq("campaign_id", CAMPAIGN_ID).limit(5);
  console.log("calls for Canary #3 campaign:", campCalls?.length);
  if (campCalls?.length) console.log(JSON.stringify(campCalls, null, 2));

  const fiveMinAgo = new Date(Date.now() - 5*60000).toISOString();
  const { data: recentCalls } = await admin.from("calls")
    .select("id,campaign_id,technical_status,ended_at,routing_data,created_at")
    .eq("workspace_id", WS_ID)
    .gte("created_at", fiveMinAgo)
    .order("created_at", { ascending: false }).limit(5);
  console.log("recent calls (last 5min):", recentCalls?.length);
  if (recentCalls?.length) console.log(JSON.stringify(recentCalls, null, 2));

  const { data: zombies } = await admin.from("calls")
    .select("id,technical_status,ended_at,routing_data,created_at")
    .eq("workspace_id", WS_ID)
    .is("ended_at", null)
    .order("created_at", { ascending: false }).limit(10);
  console.log("zombie calls (ended_at=null):", zombies?.length);
  (zombies ?? []).forEach((z: {id:string;technical_status:string|null;created_at:string;routing_data:unknown}) =>
    console.log(`  ${z.id} tech=${z.technical_status} created=${z.created_at.slice(11,19)} routing=${JSON.stringify(z.routing_data)?.slice(0,100)}`));
}

main().catch(e => { console.error(e); process.exit(1); });
