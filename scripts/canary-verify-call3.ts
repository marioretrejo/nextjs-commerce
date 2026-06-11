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
const CALL_ID = "7e929400-964c-40c2-9908-ec9e413ddd64";
const CAMPAIGN_ID = "7663705c-08fd-4d07-9b3e-10ceb12d46f1";
const CONTACT_ID = "fdfb4bc0-f5d3-4fe6-9292-0e57945ae67a";

async function main() {
  const { data: ws } = await admin
    .from("workspaces")
    .select("active_calls")
    .eq("id", WS_ID)
    .single();
  console.log("active_calls:", ws?.active_calls);

  const { data: call } = await admin
    .from("calls")
    .select(
      "id,status,technical_status,ended_at,answered_at,duration_seconds,end_reason,routing_data",
    )
    .eq("id", CALL_ID)
    .single();
  const rd = call?.routing_data as Record<string, unknown>;
  console.log(
    "call: status=%s technical_status=%s ended_at=%s duration=%ss twilio_sid=%s",
    call?.status,
    call?.technical_status,
    call?.ended_at?.slice(11, 23) ?? "null",
    call?.duration_seconds,
    rd?.["twilio_call_sid"] ?? "—",
  );

  const { data: contact } = await admin
    .from("campaign_contacts")
    .select("status,attempts")
    .eq("id", CONTACT_ID)
    .single();
  console.log(
    "contact: status=%s attempts=%s",
    contact?.status,
    contact?.attempts,
  );

  const { data: jobs } = await admin
    .from("post_call_jobs")
    .select("job_type,status")
    .eq("call_id", CALL_ID);
  console.log(
    "post_call_jobs:",
    jobs?.length ?? 0,
    jobs
      ?.map(
        (j: { job_type: string; status: string }) =>
          `${j.job_type}:${j.status}`,
      )
      .join(", ") ?? "none",
  );

  // Check all zombie calls (not just recent ones)
  const { data: zombies } = await admin
    .from("calls")
    .select("id,technical_status,routing_data,created_at")
    .eq("workspace_id", WS_ID)
    .is("ended_at", null)
    .order("created_at", { ascending: false })
    .limit(5);
  console.log(
    "\nZombie calls still open (ended_at=null):",
    zombies?.length ?? 0,
  );
  (zombies ?? []).forEach(
    (z: {
      id: string;
      technical_status: string | null;
      created_at: string;
      routing_data: unknown;
    }) => {
      const rd = z.routing_data as Record<string, unknown> | null;
      const sid = rd?.["twilio_call_sid"] ?? "no-twilio";
      console.log(
        `  ${z.id.slice(0, 8)} tech=${z.technical_status ?? "null"} created=${z.created_at.slice(11, 19)} sid=${sid}`,
      );
    },
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
