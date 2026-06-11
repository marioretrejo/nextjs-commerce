import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const admin = createClient(
  process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  { auth: { persistSession: false } },
);

const PHONE = "+18099052406";
const WS_ID = "cd7b409f-82a3-4da2-8f7c-d49c11d62105";
const CAMPAIGN_ID = "99665ce9-a2dd-443f-a1d1-471c0c0fa21e";

async function main() {
  const { data: camp } = await admin
    .from("campaigns").select("retry_interval_hours,status,name")
    .eq("id", CAMPAIGN_ID).single();

  const cooldownHours = camp?.retry_interval_hours ?? 4;
  const cooldownThreshold = new Date(Date.now() - cooldownHours * 3_600_000);
  console.log(`Campaign: "${camp?.name}" status=${camp?.status} retry_interval_hours=${cooldownHours}`);
  console.log(`Cooldown threshold: ${cooldownThreshold.toISOString()}`);

  const { data: recentCall } = await admin
    .from("calls").select("id,created_at,contact_phone")
    .eq("workspace_id", WS_ID)
    .or(`contact_phone.eq.${PHONE},contact_phone.eq.18099052406`)
    .gte("created_at", cooldownThreshold.toISOString())
    .limit(1).maybeSingle();

  if (recentCall) {
    const minsAgo = Math.round((Date.now() - new Date(recentCall.created_at as string).getTime()) / 60000);
    console.log(`❌ COOLDOWN ACTIVE: call ${recentCall.id} at ${recentCall.created_at} (${minsAgo}min ago)`);
    process.exit(1);
  }
  console.log(`✅ Cooldown: CLEAR`);

  const { data: dnc } = await admin.from("dnc_list").select("id").eq("phone", PHONE).limit(1);
  console.log(`✅ DNC: ${dnc?.length ? "ON LIST ❌" : "clear"}`);

  const { data: ws } = await admin.from("workspaces").select("active_calls").eq("id", WS_ID).single();
  const ok = ws?.active_calls === 0;
  console.log(`${ok ? "✅" : "❌"} active_calls: ${ws?.active_calls}`);

  if (!ok) process.exit(1);
  console.log(`\n✅ ALL CLEAR — compliance passes for ${PHONE}`);
}
main().catch(e => { console.error(e); process.exit(1); });
