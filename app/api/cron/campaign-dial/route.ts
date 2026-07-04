/**
 * GET /api/cron/campaign-dial
 *
 * Vercel Cron — runs every 5 minutes.
 * 1. Finds all active campaigns.
 * 2. For each: resets eligible no_answer/voicemail contacts back to "pending"
 *    (retry gate: attempts < max_retries AND last_called_at + retry_interval_hours ago).
 * 3. Dials up to max_concurrency pending contacts per campaign using LiveKit/SIP/Twilio.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { RoomServiceClient, SipClient } from "livekit-server-sdk";
import { getRegionalHttpUrl } from "@/lib/livekit/edge";
import {
  checkDialEligibility,
  recordDialEligibilityCheck,
} from "@/lib/compliance/dial-eligibility";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface CampaignRow {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  max_concurrency: number;
  retry_enabled: boolean;
  retry_interval_hours: number;
  max_retries: number;
}

interface ContactRow {
  id: string;
  phone: string;
  name: string | null;
  variables: Record<string, string>;
  attempts: number;
}

interface AgentRow {
  id: string;
  name: string;
  system_prompt: string | null;
  first_message: string | null;
  voice_id: string | null;
  voice_emotion: string | null;
  flow_json: unknown | null;
  flow_config: unknown | null;
  transfer_number: string | null;
  amd_enabled: boolean;
  amd_action: "hangup" | "leave_voicemail" | null;
}

interface WorkspaceRow {
  id: string;
  minutes_used: number;
  minutes_limit: number;
  is_suspended: boolean;
}

// US area-code → IANA timezone mapping (covers all US/Canada zones)
const AREA_CODE_TZ: Record<string, string> = {
  "201": "America/New_York",
  "202": "America/New_York",
  "203": "America/New_York",
  "205": "America/Chicago",
  "206": "America/Los_Angeles",
  "207": "America/New_York",
  "208": "America/Boise",
  "209": "America/Los_Angeles",
  "210": "America/Chicago",
  "212": "America/New_York",
  "213": "America/Los_Angeles",
  "214": "America/Chicago",
  "215": "America/New_York",
  "216": "America/New_York",
  "217": "America/Chicago",
  "218": "America/Chicago",
  "219": "America/Chicago",
  "224": "America/Chicago",
  "225": "America/Chicago",
  "228": "America/Chicago",
  "229": "America/New_York",
  "231": "America/New_York",
  "239": "America/New_York",
  "240": "America/New_York",
  "248": "America/New_York",
  "251": "America/Chicago",
  "252": "America/New_York",
  "253": "America/Los_Angeles",
  "254": "America/Chicago",
  "256": "America/Chicago",
  "260": "America/New_York",
  "262": "America/Chicago",
  "267": "America/New_York",
  "269": "America/New_York",
  "270": "America/Chicago",
  "272": "America/New_York",
  "276": "America/New_York",
  "281": "America/Chicago",
  "301": "America/New_York",
  "302": "America/New_York",
  "303": "America/Denver",
  "304": "America/New_York",
  "305": "America/New_York",
  "307": "America/Denver",
  "308": "America/Chicago",
  "309": "America/Chicago",
  "310": "America/Los_Angeles",
  "312": "America/Chicago",
  "313": "America/New_York",
  "314": "America/Chicago",
  "315": "America/New_York",
  "316": "America/Chicago",
  "317": "America/New_York",
  "318": "America/Chicago",
  "319": "America/Chicago",
  "320": "America/Chicago",
  "321": "America/New_York",
  "323": "America/Los_Angeles",
  "325": "America/Chicago",
  "330": "America/New_York",
  "331": "America/Chicago",
  "334": "America/Chicago",
  "336": "America/New_York",
  "337": "America/Chicago",
  "339": "America/New_York",
  "346": "America/Chicago",
  "347": "America/New_York",
  "351": "America/New_York",
  "352": "America/New_York",
  "360": "America/Los_Angeles",
  "361": "America/Chicago",
  "385": "America/Denver",
  "386": "America/New_York",
  "401": "America/New_York",
  "402": "America/Chicago",
  "404": "America/New_York",
  "405": "America/Chicago",
  "406": "America/Denver",
  "407": "America/New_York",
  "408": "America/Los_Angeles",
  "409": "America/Chicago",
  "410": "America/New_York",
  "412": "America/New_York",
  "413": "America/New_York",
  "414": "America/Chicago",
  "415": "America/Los_Angeles",
  "417": "America/Chicago",
  "419": "America/New_York",
  "423": "America/New_York",
  "424": "America/Los_Angeles",
  "425": "America/Los_Angeles",
  "430": "America/Chicago",
  "432": "America/Chicago",
  "434": "America/New_York",
  "435": "America/Denver",
  "440": "America/New_York",
  "442": "America/Los_Angeles",
  "443": "America/New_York",
  "458": "America/Los_Angeles",
  "469": "America/Chicago",
  "470": "America/New_York",
  "475": "America/New_York",
  "478": "America/New_York",
  "479": "America/Chicago",
  "480": "America/Phoenix",
  "484": "America/New_York",
  "501": "America/Chicago",
  "502": "America/New_York",
  "503": "America/Los_Angeles",
  "504": "America/Chicago",
  "505": "America/Denver",
  "507": "America/Chicago",
  "508": "America/New_York",
  "509": "America/Los_Angeles",
  "510": "America/Los_Angeles",
  "512": "America/Chicago",
  "513": "America/New_York",
  "515": "America/Chicago",
  "516": "America/New_York",
  "517": "America/New_York",
  "518": "America/New_York",
  "520": "America/Phoenix",
  "530": "America/Los_Angeles",
  "531": "America/Chicago",
  "534": "America/Chicago",
  "539": "America/Chicago",
  "540": "America/New_York",
  "541": "America/Los_Angeles",
  "551": "America/New_York",
  "559": "America/Los_Angeles",
  "561": "America/New_York",
  "562": "America/Los_Angeles",
  "563": "America/Chicago",
  "567": "America/New_York",
  "570": "America/New_York",
  "571": "America/New_York",
  "573": "America/Chicago",
  "574": "America/New_York",
  "575": "America/Denver",
  "580": "America/Chicago",
  "585": "America/New_York",
  "586": "America/New_York",
  "601": "America/Chicago",
  "602": "America/Phoenix",
  "603": "America/New_York",
  "605": "America/Chicago",
  "606": "America/New_York",
  "607": "America/New_York",
  "608": "America/Chicago",
  "609": "America/New_York",
  "610": "America/New_York",
  "612": "America/Chicago",
  "614": "America/New_York",
  "615": "America/Chicago",
  "616": "America/New_York",
  "617": "America/New_York",
  "618": "America/Chicago",
  "619": "America/Los_Angeles",
  "620": "America/Chicago",
  "623": "America/Phoenix",
  "626": "America/Los_Angeles",
  "628": "America/Los_Angeles",
  "629": "America/Chicago",
  "630": "America/Chicago",
  "631": "America/New_York",
  "636": "America/Chicago",
  "641": "America/Chicago",
  "646": "America/New_York",
  "650": "America/Los_Angeles",
  "651": "America/Chicago",
  "657": "America/Los_Angeles",
  "660": "America/Chicago",
  "661": "America/Los_Angeles",
  "662": "America/Chicago",
  "667": "America/New_York",
  "669": "America/Los_Angeles",
  "678": "America/New_York",
  "681": "America/New_York",
  "682": "America/Chicago",
  "701": "America/Chicago",
  "702": "America/Los_Angeles",
  "703": "America/New_York",
  "704": "America/New_York",
  "706": "America/New_York",
  "707": "America/Los_Angeles",
  "708": "America/Chicago",
  "712": "America/Chicago",
  "713": "America/Chicago",
  "714": "America/Los_Angeles",
  "715": "America/Chicago",
  "716": "America/New_York",
  "717": "America/New_York",
  "718": "America/New_York",
  "719": "America/Denver",
  "720": "America/Denver",
  "724": "America/New_York",
  "725": "America/Los_Angeles",
  "727": "America/New_York",
  "731": "America/Chicago",
  "732": "America/New_York",
  "734": "America/New_York",
  "737": "America/Chicago",
  "740": "America/New_York",
  "747": "America/Los_Angeles",
  "754": "America/New_York",
  "757": "America/New_York",
  "760": "America/Los_Angeles",
  "762": "America/New_York",
  "763": "America/Chicago",
  "765": "America/New_York",
  "769": "America/Chicago",
  "770": "America/New_York",
  "772": "America/New_York",
  "773": "America/Chicago",
  "774": "America/New_York",
  "775": "America/Los_Angeles",
  "779": "America/Chicago",
  "781": "America/New_York",
  "785": "America/Chicago",
  "786": "America/New_York",
  "801": "America/Denver",
  "802": "America/New_York",
  "803": "America/New_York",
  "804": "America/New_York",
  "805": "America/Los_Angeles",
  "806": "America/Chicago",
  "808": "Pacific/Honolulu",
  "810": "America/New_York",
  "812": "America/New_York",
  "813": "America/New_York",
  "814": "America/New_York",
  "815": "America/Chicago",
  "816": "America/Chicago",
  "817": "America/Chicago",
  "818": "America/Los_Angeles",
  "828": "America/New_York",
  "830": "America/Chicago",
  "831": "America/Los_Angeles",
  "832": "America/Chicago",
  "843": "America/New_York",
  "845": "America/New_York",
  "847": "America/Chicago",
  "848": "America/New_York",
  "850": "America/Chicago",
  "856": "America/New_York",
  "857": "America/New_York",
  "858": "America/Los_Angeles",
  "859": "America/New_York",
  "860": "America/New_York",
  "862": "America/New_York",
  "863": "America/New_York",
  "864": "America/New_York",
  "865": "America/New_York",
  "870": "America/Chicago",
  "872": "America/Chicago",
  "878": "America/New_York",
  "901": "America/Chicago",
  "903": "America/Chicago",
  "904": "America/New_York",
  "906": "America/New_York",
  "907": "America/Anchorage",
  "908": "America/New_York",
  "909": "America/Los_Angeles",
  "910": "America/New_York",
  "912": "America/New_York",
  "913": "America/Chicago",
  "914": "America/New_York",
  "915": "America/Denver",
  "916": "America/Los_Angeles",
  "917": "America/New_York",
  "918": "America/Chicago",
  "919": "America/New_York",
  "920": "America/Chicago",
  "925": "America/Los_Angeles",
  "928": "America/Phoenix",
  "929": "America/New_York",
  "931": "America/Chicago",
  "936": "America/Chicago",
  "937": "America/New_York",
  "940": "America/Chicago",
  "941": "America/New_York",
  "945": "America/Chicago",
  "947": "America/New_York",
  "949": "America/Los_Angeles",
  "952": "America/Chicago",
  "954": "America/New_York",
  "956": "America/Chicago",
  "959": "America/New_York",
  "970": "America/Denver",
  "971": "America/Los_Angeles",
  "972": "America/Chicago",
  "973": "America/New_York",
  "978": "America/New_York",
  "979": "America/Chicago",
  "980": "America/New_York",
  "984": "America/New_York",
  "985": "America/Chicago",
  "989": "America/New_York",
};

function isWithinTcpaHours(phone: string): boolean {
  // Extract area code (handle +1XXXXXXXXXX and XXXXXXXXXX)
  const digits = phone.replace(/\D/g, "");
  const areaCode = digits.startsWith("1")
    ? digits.slice(1, 4)
    : digits.slice(0, 3);
  const tz = AREA_CODE_TZ[areaCode] ?? "America/New_York";

  const now = new Date();
  const localHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }).format(now),
    10,
  );
  return localHour >= 9 && localHour < 18; // 9 AM – 6 PM
}

interface SipIntegrationRow {
  id: string;
  credentials: {
    provider_name: string;
    sip_host: string;
    username: string;
    password: string;
    livekit_trunk_id?: string;
  };
}

async function dialContact(params: {
  admin: ReturnType<typeof createAdminClient>;
  workspace: WorkspaceRow;
  campaign: CampaignRow;
  agent: AgentRow;
  contact: ContactRow;
  apiKey: string;
  apiSecret: string;
  httpUrl: string;
}): Promise<void> {
  const {
    admin,
    workspace,
    campaign,
    agent,
    contact,
    apiKey,
    apiSecret,
    httpUrl,
  } = params;

  // ── Compliance pre-dial gate ────────────────────────────────────────────────
  // Must run BEFORE slot acquisition and LiveKit room creation.
  const eligibility = await checkDialEligibility({
    workspaceId: workspace.id,
    campaignId: campaign.id,
    leadId: contact.id,
    phoneNumber: contact.phone,
    supabase: admin,
  });
  void recordDialEligibilityCheck(
    eligibility,
    {
      workspaceId: workspace.id,
      campaignId: campaign.id,
      leadId: contact.id,
      phoneNumber: contact.phone,
    },
    admin,
  );
  if (!eligibility.allowed) {
    // Mark contact as skipped so it is not retried as a technical failure
    if (
      eligibility.reason_code === "dnc" ||
      eligibility.reason_code === "opt_out"
    ) {
      void admin
        .from("campaign_contacts")
        .update({ status: "rejected" })
        .eq("id", contact.id);
    }
    console.log(
      `[cron/campaign-dial] blocked by compliance: ${eligibility.reason_code} for ${eligibility.normalized_phone ?? contact.phone}`,
    );
    return;
  }

  // Auto-heal zombie slots before claiming
  const staleAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  try {
    await admin
      .from("workspaces")
      .update({ active_calls: 0 })
      .eq("id", workspace.id)
      .gt("active_calls", 0)
      .or(
        `active_calls_last_claimed_at.is.null,active_calls_last_claimed_at.lt.${staleAt}`,
      );
  } catch {
    /* non-fatal */
  }

  // Claim concurrent slot
  const { data: claimed } = await admin.rpc("try_claim_call_slot", {
    p_workspace_id: workspace.id,
  });
  if (!claimed) return; // concurrency limit reached

  const roomName = `agent-${campaign.agent_id}-${Date.now()}`;

  // Atomically claim the contact (compare-and-swap): flip pending → calling only
  // if it is still pending. Two concurrent runners (the continuous worker and the
  // Vercel cron, or overlapping worker cycles) can both SELECT the same pending
  // contact; without this guard both would dial it, double-billing the workspace
  // and breaching call-frequency compliance. The runner whose UPDATE affects 0
  // rows lost the race — it releases its call slot and skips.
  const { data: claimedRows } = await admin
    .from("campaign_contacts")
    .update({
      status: "calling",
      attempts: contact.attempts + 1,
      last_called_at: new Date().toISOString(),
    })
    .eq("id", contact.id)
    .eq("status", "pending")
    .select("id");

  if (!claimedRows || claimedRows.length === 0) {
    // Another runner already claimed this contact — release the slot and skip.
    void Promise.resolve(
      admin.rpc("release_call_slot", { p_workspace_id: workspace.id }),
    ).catch(() => null);
    return;
  }

  try {
    await new RoomServiceClient(httpUrl, apiKey, apiSecret).createRoom({
      name: roomName,
      metadata: JSON.stringify({
        agent_id: campaign.agent_id,
        agent_name: agent.name,
        system_prompt: agent.system_prompt,
        first_message: agent.first_message,
        voice_id: agent.voice_id,
        voice_emotion: agent.voice_emotion,
        workspace_id: workspace.id,
        call_direction: "outbound",
        dynamic_variables: contact.variables ?? {},
        recipient_number: contact.phone,
        campaign_id: campaign.id,
        contact_id: contact.id,
        flow_json: agent.flow_json ?? null,
        flow_config: agent.flow_config ?? null,
        transfer_number: agent.transfer_number ?? null,
      }),
      departureTimeout: 600,
    });
  } catch {
    // Room creation failed — release slot and reset contact
    void Promise.resolve(
      admin.rpc("release_call_slot", { p_workspace_id: workspace.id }),
    ).catch(() => null);
    await admin
      .from("campaign_contacts")
      .update({ status: "no_answer" })
      .eq("id", contact.id);
    return;
  }

  // Choose dial path: SIP trunk > Twilio fallback
  const { data: sipIntegration } = await admin
    .from("integrations")
    .select("id, credentials")
    .eq("workspace_id", workspace.id)
    .eq("type", "sip_trunk")
    .eq("status", "connected")
    .maybeSingle();

  // Resolve caller ID (first available workspace number)
  const { data: numberRow } = await admin
    .from("phone_numbers")
    .select("number")
    .eq("workspace_id", workspace.id)
    .eq("status", "available")
    .limit(1)
    .single();
  const callerId =
    (numberRow as { number: string } | null)?.number ??
    process.env["TWILIO_PHONE_NUMBER"] ??
    "";

  if (sipIntegration) {
    const creds = (sipIntegration as SipIntegrationRow).credentials;
    const sipClient = new SipClient(httpUrl, apiKey, apiSecret);

    let trunkId = creds.livekit_trunk_id;
    if (!trunkId) {
      const trunk = await sipClient.createSipOutboundTrunk(
        `voiceos-${workspace.id}`,
        creds.sip_host,
        callerId ? [callerId] : [],
        {
          transport: 0,
          authUsername: creds.username,
          authPassword: creds.password,
        },
      );
      trunkId = trunk.sipTrunkId;
      void admin
        .from("integrations")
        .update({
          credentials: { ...creds, livekit_trunk_id: trunkId },
        })
        .eq("id", (sipIntegration as SipIntegrationRow).id)
        .then(
          () => null,
          () => null,
        );
    }

    try {
      await sipClient.createSipParticipant(trunkId, contact.phone, roomName, {
        participantIdentity: `sip-${contact.phone}`,
        participantName: contact.phone,
        waitUntilAnswered: false,
        playRingtone: false,
      });
      await admin.from("calls").insert({
        workspace_id: workspace.id,
        agent_id: campaign.agent_id,
        campaign_id: campaign.id,
        retell_call_id: roomName,
        direction: "outbound",
        contact_phone: contact.phone,
        contact_name: contact.name,
        status: "dialing",
        cost_usd: 0,
        routing_data: { method: "livekit_sip_egress", campaign_dial: true },
      });
    } catch {
      void Promise.resolve(
        admin.rpc("release_call_slot", { p_workspace_id: workspace.id }),
      ).catch(() => null);
      await admin
        .from("campaign_contacts")
        .update({ status: "no_answer" })
        .eq("id", contact.id);
    }
    return;
  }

  // Twilio fallback
  const twilioSid = process.env["TWILIO_ACCOUNT_SID"];
  const twilioToken = process.env["TWILIO_AUTH_TOKEN"];
  const appUrl = process.env["VERCEL_URL"]
    ? `https://${process.env["VERCEL_URL"]}`
    : (process.env["NEXT_PUBLIC_APP_URL"] ?? "");
  const livekitSipHost = process.env["LIVEKIT_SIP_HOST"] ?? "sip.livekit.run";

  if (!twilioSid || !twilioToken || !callerId) {
    void Promise.resolve(
      admin.rpc("release_call_slot", { p_workspace_id: workspace.id }),
    ).catch(() => null);
    await admin
      .from("campaign_contacts")
      .update({ status: "invalid" })
      .eq("id", contact.id);
    return;
  }

  const twimlCallbackUrl = `${appUrl}/api/v1/outbound/twiml?room=${encodeURIComponent(roomName)}&host=${encodeURIComponent(livekitSipHost)}`;
  const twilioParams = new URLSearchParams({
    To: contact.phone,
    From: callerId,
    Url: twimlCallbackUrl,
    StatusCallback: `${appUrl}/api/webhooks/twilio/status`,
    StatusCallbackMethod: "POST",
    Timeout: "25",
  });
  // Twilio REST API requires separate parameters per event (not space-separated string)
  twilioParams.append("StatusCallbackEvent", "answered");
  twilioParams.append("StatusCallbackEvent", "completed");

  // AMD — always respect the agent's answering-machine-detection setting
  if (agent.amd_enabled) {
    twilioParams.set("MachineDetection", "Enable");
    twilioParams.set("MachineDetectionTimeout", "30");
    // AsyncAMD sends a separate status callback when detection completes,
    // so the main webhook still fires immediately and can act on AnsweredBy.
    twilioParams.set(
      "AsyncAmdStatusCallback",
      `${appUrl}/api/webhooks/twilio/status`,
    );
    twilioParams.set("AsyncAmdStatusCallbackMethod", "POST");
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: twilioParams.toString(),
      },
    );
    if (!res.ok) throw new Error(`Twilio ${res.status}`);
    const { sid } = (await res.json()) as { sid: string };
    await admin.from("calls").insert({
      workspace_id: workspace.id,
      agent_id: campaign.agent_id,
      campaign_id: campaign.id,
      retell_call_id: roomName,
      direction: "outbound",
      contact_phone: contact.phone,
      contact_name: contact.name,
      status: "dialing",
      cost_usd: 0,
      routing_data: {
        method: "twilio_twiml",
        twilio_call_sid: sid,
        campaign_dial: true,
        amd_action: agent.amd_enabled ? (agent.amd_action ?? "hangup") : null,
      },
    });
  } catch {
    void Promise.resolve(
      admin.rpc("release_call_slot", { p_workspace_id: workspace.id }),
    ).catch(() => null);
    await admin
      .from("campaign_contacts")
      .update({ status: "no_answer" })
      .eq("id", contact.id);
  }
}

function verifyCronSecret(req: Request): boolean {
  const secret =
    process.env["CRON_SECRET"] ?? process.env["INTERNAL_API_SECRET"];
  if (!secret || secret.trim().length < 16) return false;
  const authHeader = req.headers.get("Authorization");
  const provided = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  if (!provided) return false;
  const a = Buffer.from(secret, "utf8");
  const b = Buffer.from(provided.trim(), "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const apiKey = process.env["LIVEKIT_API_KEY"];
  const apiSecret = process.env["LIVEKIT_API_SECRET"];
  const httpUrl = getRegionalHttpUrl();

  if (!apiKey || !apiSecret || !httpUrl) {
    return NextResponse.json(
      { error: "LiveKit not configured" },
      { status: 500 },
    );
  }

  // Load all active campaigns
  const { data: campaigns } = await admin
    .from("campaigns")
    .select(
      "id, workspace_id, agent_id, max_concurrency, retry_enabled, retry_interval_hours, max_retries",
    )
    .eq("status", "active");

  if (!campaigns?.length) return NextResponse.json({ ok: true, dialed: 0 });

  let totalDialed = 0;

  for (const campaign of campaigns as CampaignRow[]) {
    if (!campaign.agent_id) continue;

    // ── 1. Reset eligible contacts to pending (retry gate) ──────────────────
    if (campaign.retry_enabled) {
      const retryBefore = new Date(
        Date.now() - campaign.retry_interval_hours * 3_600_000,
      ).toISOString();

      await admin
        .from("campaign_contacts")
        .update({ status: "pending" })
        .eq("campaign_id", campaign.id)
        .in("status", ["no_answer", "voicemail"])
        .lt("attempts", campaign.max_retries)
        .lt("last_called_at", retryBefore);
    }

    // ── 2. Load workspace for limit checks ──────────────────────────────────
    const { data: ws } = await admin
      .from("workspaces")
      .select("id, minutes_used, minutes_limit, is_suspended")
      .eq("id", campaign.workspace_id)
      .single();

    const workspace = ws as WorkspaceRow | null;
    if (!workspace || workspace.is_suspended) continue;
    if (Number(workspace.minutes_used) >= Number(workspace.minutes_limit))
      continue;

    // ── 3. Load agent ────────────────────────────────────────────────────────
    const { data: agentData } = await admin
      .from("agents")
      .select(
        "id, name, system_prompt, first_message, voice_id, voice_emotion, flow_json, flow_config, transfer_number, amd_enabled, amd_action",
      )
      .eq("id", campaign.agent_id)
      .single();
    if (!agentData) continue;
    const agent = agentData as AgentRow;

    // ── 4. Load pending contacts up to concurrency limit ────────────────────
    const { data: contacts } = await admin
      .from("campaign_contacts")
      .select("id, phone, name, variables, attempts")
      .eq("campaign_id", campaign.id)
      .eq("status", "pending")
      .limit(campaign.max_concurrency * 3); // fetch 3x to account for DNC/TCPA exclusions

    if (!contacts?.length) continue;

    // ── 4a. DNC check — filter out numbers on the workspace DNC list ─────────
    const phones = (contacts as ContactRow[]).map((c) => c.phone);
    const { data: dncHits } = await admin
      .from("dnc_list")
      .select("phone")
      .eq("workspace_id", campaign.workspace_id)
      .in("phone", phones);
    const dncSet = new Set(
      (dncHits ?? []).map((d: { phone: string }) => d.phone),
    );

    // Mark DNC contacts as rejected so they don't get retried
    const dncContacts = (contacts as ContactRow[]).filter((c) =>
      dncSet.has(c.phone),
    );
    if (dncContacts.length) {
      await admin
        .from("campaign_contacts")
        .update({ status: "rejected" })
        .in(
          "id",
          dncContacts.map((c) => c.id),
        );
    }

    // ── 4b. TCPA hours check — skip contacts outside 9 AM–6 PM local time ───
    const dialable = (contacts as ContactRow[])
      .filter((c) => !dncSet.has(c.phone) && isWithinTcpaHours(c.phone))
      .slice(0, campaign.max_concurrency);

    if (!dialable.length) continue;

    // ── 5. Dial in parallel ──────────────────────────────────────────────────
    await Promise.allSettled(
      dialable.map((contact) =>
        dialContact({
          admin,
          workspace,
          campaign,
          agent,
          contact,
          apiKey,
          apiSecret,
          httpUrl,
        }),
      ),
    );

    totalDialed += dialable.length;
  }

  return NextResponse.json({ ok: true, dialed: totalDialed });
}
