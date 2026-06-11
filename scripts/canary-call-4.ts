/**
 * Canary Call #4 — supervised outbound call
 * Agent: Ventas Outbound LATAM (295cdc22-f4da-45ed-8f7b-3815b3a0ea5f)
 * Destination: +18099052406
 * Caller ID:   +17753129298
 *
 * Fixes validated in this build (commit cf50650):
 *   Fix #3 — VERCEL_URL self-healing: TwiML + StatusCallback → preview URL
 *   Fix #4 — StatusCallbackEvent: "initiated ringing answered completed" (no 21626)
 *   Fix #5 — answered_at gate: post_call_jobs blocked for calls with no agent connection
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

const VERCEL_URL =
  "https://nextjs-commerce-git-claude-voic-6cb608-marios-projects-0d440ccd.vercel.app";
const AGENT_ID = "295cdc22-f4da-45ed-8f7b-3815b3a0ea5f";
const DEST_PHONE = "+18099052406";
const INTERNAL_SECRET = process.env["INTERNAL_API_SECRET"]!;

function ts() {
  return new Date().toISOString().slice(11, 23);
}

// ─── PRE-FLIGHT COMPLIANCE CHECK ─────────────────────────────────────────────
async function preFlightCheck(wsId: string) {
  console.log(`[${ts()}] === PRE-FLIGHT COMPLIANCE CHECK ===`);

  const { data: ws } = await admin
    .from("workspaces")
    .select("active_calls,minutes_used,concurrent_calls_limit,billing_status")
    .eq("id", wsId)
    .single();
  console.log(
    `[${ts()}] Workspace: active_calls=${ws?.active_calls} max=${ws?.concurrent_calls_limit} minutes_used=${ws?.minutes_used} billing=${ws?.billing_status}`,
  );
  if ((ws?.active_calls ?? 0) > 0) throw new Error("active_calls > 0 — abort");

  const { data: dnc } = await admin
    .from("dnc_list")
    .select("id")
    .eq("phone", DEST_PHONE)
    .limit(1);
  if (dnc && dnc.length > 0)
    throw new Error(`${DEST_PHONE} is on DNC list — abort`);
  console.log(`[${ts()}] DNC check: CLEAR`);

  const { data: agent } = await admin
    .from("agents")
    .select("id,name,status")
    .eq("id", AGENT_ID)
    .single();
  if (!agent) throw new Error(`Agent ${AGENT_ID} not found`);
  console.log(`[${ts()}] Agent: "${agent.name}" status=${agent.status}`);

  const { data: zombies } = await admin
    .from("calls")
    .select("id")
    .eq("workspace_id", wsId)
    .is("ended_at", null)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .limit(3);
  console.log(
    `[${ts()}] Recent zombie calls (last 1h, ended_at=null): ${zombies?.length ?? 0}`,
  );
  if ((zombies?.length ?? 0) > 0)
    console.warn(`[${ts()}] ⚠️  Recent zombie calls detected`);

  console.log(`[${ts()}] Pre-flight: ALL CLEAR ✅\n`);
  return ws;
}

// ─── CREATE CAMPAIGN + CONTACT ────────────────────────────────────────────────
async function createCampaign(wsId: string) {
  console.log(`[${ts()}] === CREATING CANARY CALL #4 CAMPAIGN ===`);

  const { data: camp, error: campErr } = await admin
    .from("campaigns")
    .insert({
      workspace_id: wsId,
      agent_id: AGENT_ID,
      name: `Canary Call #4 — ${new Date().toISOString()}`,
      status: "draft",
      max_concurrency: 1,
      retry_enabled: false,
      max_retries: 0,
      retry_interval_hours: 1,
    })
    .select("id")
    .single();
  if (campErr || !camp)
    throw new Error(`Campaign create failed: ${campErr?.message}`);
  console.log(`[${ts()}] Campaign created: ${camp.id}`);

  const { data: contact, error: contactErr } = await admin
    .from("campaign_contacts")
    .insert({
      campaign_id: camp.id,
      phone: DEST_PHONE,
      name: "Canary Test #4",
      status: "pending",
    })
    .select("id")
    .single();
  if (contactErr || !contact)
    throw new Error(`Contact insert failed: ${contactErr?.message}`);
  console.log(`[${ts()}] Contact created: ${contact.id}`);

  const { error: activateErr } = await admin
    .from("campaigns")
    .update({ status: "active" })
    .eq("id", camp.id);
  if (activateErr)
    throw new Error(`Campaign activate failed: ${activateErr.message}`);
  console.log(`[${ts()}] Campaign activated ✅`);

  return { campaignId: camp.id, contactId: contact.id };
}

// ─── TRIGGER DIAL ────────────────────────────────────────────────────────────
async function triggerDial(campaignId: string) {
  console.log(`[${ts()}] === TRIGGERING DIAL ===`);
  console.log(`[${ts()}] TwiML URL  → ${VERCEL_URL}/api/v1/outbound/twiml`);
  console.log(
    `[${ts()}] StatusCallback → ${VERCEL_URL}/api/webhooks/twilio/status`,
  );
  console.log(
    `[${ts()}] StatusCallbackEvent → "initiated ringing answered completed"`,
  );

  const url = `${VERCEL_URL}/api/cron/campaign-dial`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${INTERNAL_SECRET}` },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.text();
  console.log(
    `[${ts()}] Cron response: HTTP ${res.status} — ${body.slice(0, 400)}`,
  );
  if (res.status !== 200)
    throw new Error(`Dial trigger failed: HTTP ${res.status} — ${body}`);
  const json = JSON.parse(body) as {
    ok: boolean;
    dialed?: number;
    error?: string;
  };
  if (!json.ok || (json.dialed ?? 0) < 1)
    throw new Error(
      `Dial returned dialed=${json.dialed}: ${json.error ?? "unknown"}`,
    );
  console.log(`[${ts()}] Dial triggered: dialed=${json.dialed} ✅`);
  console.log(
    `[${ts()}] ⚠️  ANSWER THE CALL when your phone rings at ${DEST_PHONE}`,
  );
  console.log(
    `[${ts()}]    Twilio Trial disclaimer will play — press any key when prompted\n`,
  );
}

// ─── MONITOR ─────────────────────────────────────────────────────────────────
async function monitorCall(
  campaignId: string,
  contactId: string,
  wsId: string,
) {
  console.log(
    `[${ts()}] === MONITORING CALL (poll every 3s, timeout 10min) ===\n`,
  );

  let callId: string | null = null;
  let roomName: string | null = null;
  let twilioSid: string | null = null;

  // Wait up to 45s for the call record to appear
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const { data: c } = await admin
      .from("calls")
      .select("id,retell_call_id,technical_status,routing_data,created_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (c?.id) {
      callId = c.id;
      roomName = c.retell_call_id ?? null;
      const rd = c.routing_data as Record<string, unknown>;
      twilioSid = (rd?.["twilio_call_sid"] as string) ?? null;
      console.log(`[${ts()}] ✅ Call record: id=${callId}`);
      console.log(`[${ts()}]    Twilio SID : ${twilioSid ?? "pending"}`);
      console.log(`[${ts()}]    LiveKit    : ${roomName ?? "pending"}`);
      console.log(`[${ts()}]    Status     : ${c.technical_status ?? "—"}`);
      break;
    }
    if (i % 3 === 0)
      console.log(`[${ts()}] Waiting for call record... (${(i + 1) * 3}s)`);
  }

  if (!callId) {
    const { data: ws } = await admin
      .from("workspaces")
      .select("active_calls")
      .eq("id", wsId)
      .single();
    console.error(
      `[${ts()}] ❌ No call record after 45s. active_calls=${ws?.active_calls}`,
    );
    return null;
  }

  let lastStatus = "";
  let callEnded = false;
  let answeredAt: string | null = null;
  let endedAt: string | null = null;
  let lastEventCount = 0;

  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 3000));

    const { data: call } = await admin
      .from("calls")
      .select(
        "id,retell_call_id,technical_status,business_outcome,answered_at,ended_at,duration_seconds,cost_usd,routing_data,end_reason",
      )
      .eq("id", callId)
      .single();
    if (!call) continue;

    const rd = call.routing_data as Record<string, unknown>;
    if (!twilioSid && rd?.["twilio_call_sid"])
      twilioSid = rd["twilio_call_sid"] as string;
    roomName = call.retell_call_id ?? roomName;
    answeredAt = call.answered_at;

    const status = `${call.technical_status ?? "—"}/${call.business_outcome ?? "—"}`;
    if (status !== lastStatus) {
      console.log(
        `[${ts()}] 📞 ${status} | answered=${call.answered_at ? "YES ✅" : "no"} | ended=${call.ended_at ? "YES" : "no"} | duration=${call.duration_seconds ?? 0}s | cost=$${call.cost_usd ?? 0}`,
      );
      lastStatus = status;
    }

    // Poll call_events every 15s
    if (i % 5 === 0 && roomName) {
      const { data: events } = await admin
        .from("call_events")
        .select("event_type,created_at")
        .eq("call_room", roomName)
        .order("created_at", { ascending: true });
      if (events && events.length !== lastEventCount) {
        lastEventCount = events.length;
        console.log(
          `[${ts()}] 📋 Events (${events.length}): ${events.map((e: { event_type: string }) => e.event_type).join(", ")}`,
        );
      }
    }

    if (call.ended_at) {
      callEnded = true;
      endedAt = call.ended_at;
      console.log(`\n[${ts()}] 📴 CALL ENDED`);
      console.log(`  technical_status : ${call.technical_status}`);
      console.log(`  business_outcome : ${call.business_outcome ?? "—"}`);
      console.log(`  duration         : ${call.duration_seconds ?? 0}s`);
      console.log(`  answered_at      : ${call.answered_at ?? "—"}`);
      console.log(`  ended_at         : ${call.ended_at}`);
      console.log(`  end_reason       : ${call.end_reason ?? "—"}`);
      console.log(`  cost_usd         : $${call.cost_usd ?? 0}`);
      console.log(`  twilio_sid       : ${twilioSid ?? "—"}`);
      console.log(`  livekit_room     : ${call.retell_call_id ?? "—"}`);
      break;
    }
  }

  if (!callEnded)
    console.log(`[${ts()}] ⏰ Monitor timeout (10min) — call still active`);

  return { callId, roomName, twilioSid, answeredAt, endedAt, callEnded };
}

// ─── POST-CALL REPORT ─────────────────────────────────────────────────────────
async function postCallReport(
  callId: string,
  roomName: string | null,
  campaignId: string,
  contactId: string,
  wsId: string,
  answeredAtValue: string | null,
) {
  console.log(`\n[${ts()}] === POST-CALL STATE ===`);

  const { data: contact } = await admin
    .from("campaign_contacts")
    .select("status,attempts,last_called_at")
    .eq("id", contactId)
    .single();
  console.log(
    `[${ts()}] Contact: status=${contact?.status} attempts=${contact?.attempts}`,
  );

  const { data: camp } = await admin
    .from("campaigns")
    .select("status,completed_contacts,total_contacts")
    .eq("id", campaignId)
    .single();
  console.log(
    `[${ts()}] Campaign: status=${camp?.status} completed=${camp?.completed_contacts}/${camp?.total_contacts}`,
  );

  const { data: ws } = await admin
    .from("workspaces")
    .select("active_calls,minutes_used")
    .eq("id", wsId)
    .single();
  console.log(
    `[${ts()}] Workspace: active_calls=${ws?.active_calls} minutes_used=${ws?.minutes_used}`,
  );
  if ((ws?.active_calls ?? 1) !== 0)
    console.warn(`[${ts()}] ⚠️  active_calls is NOT 0 — slot leak!`);

  // Call events
  if (roomName) {
    const { data: events } = await admin
      .from("call_events")
      .select("event_type,payload,created_at")
      .eq("call_room", roomName)
      .order("created_at", { ascending: true });
    console.log(`\n[${ts()}] Call events (${events?.length ?? 0}):`);
    events?.forEach((e) => {
      const p = JSON.stringify(e.payload ?? {}).slice(0, 120);
      console.log(`  ${e.created_at.slice(11, 23)} ${e.event_type} ${p}`);
    });
  }

  // Post-call jobs: should only exist if answered_at was set
  const agentConnected = answeredAtValue !== null;
  console.log(
    `\n[${ts()}] Agent connected (answered_at set): ${agentConnected ? "YES" : "NO"}`,
  );
  if (!agentConnected)
    console.log(
      `[${ts()}] ⏭  post_call_jobs should be ZERO (answered_at gate)`,
    );

  console.log(`\n[${ts()}] Waiting for post_call_jobs (up to 3min)...`);
  let finalJobs: Array<{
    job_type: string;
    status: string;
    attempts: number;
    error_message: string | null;
    completed_at: string | null;
  }> = [];
  for (let i = 0; i < 36; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const { data: jobs } = await admin
      .from("post_call_jobs")
      .select("job_type,status,attempts,error_message,completed_at")
      .eq("call_id", callId)
      .order("created_at", { ascending: true });

    if (jobs?.length) {
      finalJobs = jobs;
      const summary = jobs.map((j) => `${j.job_type}:${j.status}`).join(", ");
      const pending = jobs.filter(
        (j) => !["completed", "dead_letter", "canceled"].includes(j.status),
      ).length;
      console.log(`[${ts()}] Jobs (${jobs.length}): ${summary}`);
      if (!agentConnected)
        console.warn(
          `[${ts()}] ⚠️  post_call_jobs created despite no agent connection!`,
        );
      if (pending === 0) {
        console.log(`[${ts()}] ✅ All post_call_jobs settled`);
        break;
      }
    } else if (i === 35) {
      if (agentConnected)
        console.log(
          `[${ts()}] ⚠️  No post_call_jobs after 3min (expected some)`,
        );
      else
        console.log(
          `[${ts()}] ✅ Zero post_call_jobs — correct (no agent connection)`,
        );
    } else if (i % 6 === 0) {
      console.log(`[${ts()}] No post_call_jobs yet (${i * 5}s)...`);
    }
  }

  // Provider health
  const { data: health } = await admin
    .from("provider_health_snapshots")
    .select("provider,success_rate,avg_latency_ms,snapshot_at")
    .order("snapshot_at", { ascending: false })
    .limit(6);
  console.log(`\n[${ts()}] Provider health (latest):`);
  health?.forEach((h) =>
    console.log(
      `  ${h.provider}: success_rate=${h.success_rate} avg_latency=${h.avg_latency_ms}ms @ ${h.snapshot_at?.slice(11, 19)}`,
    ),
  );

  // Recent alerts
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: alerts } = await admin
    .from("alert_events")
    .select("alert_type,severity,message,created_at")
    .gt("created_at", thirtyMinsAgo)
    .order("created_at", { ascending: false })
    .limit(10);
  console.log(`\n[${ts()}] Recent alerts (last 30min): ${alerts?.length ?? 0}`);
  alerts?.forEach((a) =>
    console.log(
      `  ${a.created_at.slice(11, 19)} [${a.severity}] ${a.alert_type}: ${a.message}`,
    ),
  );

  return { finalJobs, health, alerts };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[${ts()}] ╔═══════════════════════════════════════╗`);
  console.log(`[${ts()}] ║      CANARY CALL #4 — STARTING        ║`);
  console.log(`[${ts()}] ╚═══════════════════════════════════════╝\n`);
  console.log(`[${ts()}] Commit: cf50650 (DEPLOYED)`);
  console.log(
    `[${ts()}] Fix #3 — VERCEL_URL self-healing → callbacks hit preview`,
  );
  console.log(`[${ts()}] Fix #4 — StatusCallbackEvent valid (no Twilio 21626)`);
  console.log(`[${ts()}] Fix #5 — answered_at gate for post_call_jobs\n`);

  const { data: agent } = await admin
    .from("agents")
    .select("workspace_id")
    .eq("id", AGENT_ID)
    .single();
  if (!agent?.workspace_id)
    throw new Error("Could not determine workspace_id from agent");
  const wsId = agent.workspace_id;
  console.log(`[${ts()}] Workspace: ${wsId}\n`);

  await preFlightCheck(wsId);
  const { campaignId, contactId } = await createCampaign(wsId);
  await triggerDial(campaignId);

  const result = await monitorCall(campaignId, contactId, wsId);
  if (!result) {
    console.error(`[${ts()}] ❌ Call failed to start — check cron logs`);
    process.exit(1);
  }

  const { callId, roomName, twilioSid, answeredAt, endedAt, callEnded } =
    result;

  const report = await postCallReport(
    callId,
    roomName,
    campaignId,
    contactId,
    wsId,
    answeredAt,
  );

  console.log(
    `\n[${ts()}] ╔═══════════════════════════════════════════════════╗`,
  );
  console.log(
    `[${ts()}] ║          CANARY CALL #4 — FINAL REPORT            ║`,
  );
  console.log(
    `[${ts()}] ╚═══════════════════════════════════════════════════╝`,
  );
  console.log(`  1.  Twilio SID           : ${twilioSid ?? "not recorded"}`);
  console.log(
    `  2.  Agent connected       : ${answeredAt ? "SÍ ✅" : "NO ❌"}`,
  );
  console.log(`  3.  Call ended cleanly    : ${callEnded ? "SÍ" : "timeout"}`);
  console.log(`  4.  ended_at             : ${endedAt ?? "—"}`);
  console.log(
    `  5.  post_call_jobs count  : ${report.finalJobs.length} ${report.finalJobs.length === 0 && !answeredAt ? "(correct — no agent)" : ""}`,
  );
  console.log(
    `  6.  Jobs detail           : ${report.finalJobs.map((j) => `${j.job_type}:${j.status}`).join(", ") || "none"}`,
  );

  const criticalAlerts =
    report.alerts?.filter(
      (a: { severity: string }) => a.severity === "critical",
    ) ?? [];
  console.log(`  7.  Critical alerts       : ${criticalAlerts.length}`);

  if (answeredAt) {
    console.log(`\n[${ts()}] ✅ AGENT CONNECTED — full end-to-end validated`);
  } else {
    console.log(`\n[${ts()}] ⚠️  Agent did NOT connect (answered_at=null)`);
    console.log(
      `[${ts()}]    post_call_jobs gate: ${report.finalJobs.length === 0 ? "✅ CORRECT (0 jobs)" : "❌ FAILED (jobs created without agent)"}`,
    );
    console.log(
      `[${ts()}]    Possible: Twilio trial restriction / disclaimer not accepted`,
    );
  }

  console.log(
    `\n[${ts()}] ⛔ Canary Call #5 requires explicit user authorization.`,
  );
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
