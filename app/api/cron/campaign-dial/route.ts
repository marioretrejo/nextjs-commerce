/**
 * GET /api/cron/campaign-dial
 *
 * Vercel Cron — runs every 5 minutes.
 * 1. Finds all active campaigns.
 * 2. For each: resets eligible no_answer/voicemail contacts back to "pending"
 *    (retry gate: attempts < max_retries AND last_called_at + retry_interval_hours ago).
 * 3. Dials up to max_concurrency pending contacts per campaign using LiveKit/SIP/Twilio.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { RoomServiceClient, SipClient } from 'livekit-server-sdk';
import { getRegionalHttpUrl } from '@/lib/livekit/edge';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
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
}

interface WorkspaceRow {
  id: string;
  minutes_used: number;
  minutes_limit: number;
  is_suspended: boolean;
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
  const { admin, workspace, campaign, agent, contact, apiKey, apiSecret, httpUrl } = params;

  // Claim concurrent slot
  const { data: claimed } = await admin.rpc('try_claim_call_slot', { p_workspace_id: workspace.id });
  if (!claimed) return; // concurrency limit reached

  const roomName = `agent-${campaign.agent_id}-${Date.now()}`;

  // Mark contact as calling immediately to prevent double-dial
  await admin.from('campaign_contacts').update({
    status: 'calling',
    attempts: contact.attempts + 1,
    last_called_at: new Date().toISOString(),
  }).eq('id', contact.id);

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
        call_direction: 'outbound',
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
    void Promise.resolve(admin.rpc('release_call_slot', { p_workspace_id: workspace.id })).catch(() => null);
    await admin.from('campaign_contacts').update({ status: 'no_answer' }).eq('id', contact.id);
    return;
  }

  // Choose dial path: SIP trunk > Twilio fallback
  const { data: sipIntegration } = await admin
    .from('integrations')
    .select('id, credentials')
    .eq('workspace_id', workspace.id)
    .eq('type', 'sip_trunk')
    .eq('status', 'connected')
    .maybeSingle();

  // Resolve caller ID (first available workspace number)
  const { data: numberRow } = await admin
    .from('phone_numbers')
    .select('number')
    .eq('workspace_id', workspace.id)
    .eq('status', 'available')
    .limit(1)
    .single();
  const callerId = (numberRow as { number: string } | null)?.number ?? process.env['TWILIO_PHONE_NUMBER'] ?? '';

  if (sipIntegration) {
    const creds = (sipIntegration as SipIntegrationRow).credentials;
    const sipClient = new SipClient(httpUrl, apiKey, apiSecret);

    let trunkId = creds.livekit_trunk_id;
    if (!trunkId) {
      const trunk = await sipClient.createSipOutboundTrunk(
        `voiceos-${workspace.id}`,
        creds.sip_host,
        callerId ? [callerId] : [],
        { transport: 0, authUsername: creds.username, authPassword: creds.password }
      );
      trunkId = trunk.sipTrunkId;
      void admin.from('integrations').update({
        credentials: { ...creds, livekit_trunk_id: trunkId },
      }).eq('id', (sipIntegration as SipIntegrationRow).id).then(() => null, () => null);
    }

    try {
      await sipClient.createSipParticipant(trunkId, contact.phone, roomName, {
        participantIdentity: `sip-${contact.phone}`,
        participantName: contact.phone,
        waitUntilAnswered: false,
        playRingtone: false,
      });
      await admin.from('calls').insert({
        workspace_id: workspace.id,
        agent_id: campaign.agent_id,
        campaign_id: campaign.id,
        retell_call_id: roomName,
        direction: 'outbound',
        contact_phone: contact.phone,
        contact_name: contact.name,
        status: 'dialing',
        cost_usd: 0,
        routing_data: { method: 'livekit_sip_egress', campaign_dial: true },
      });
    } catch {
      void Promise.resolve(admin.rpc('release_call_slot', { p_workspace_id: workspace.id })).catch(() => null);
      await admin.from('campaign_contacts').update({ status: 'no_answer' }).eq('id', contact.id);
    }
    return;
  }

  // Twilio fallback
  const twilioSid   = process.env['TWILIO_ACCOUNT_SID'];
  const twilioToken = process.env['TWILIO_AUTH_TOKEN'];
  const appUrl      = process.env['NEXT_PUBLIC_APP_URL'] ?? '';
  const livekitSipHost = process.env['LIVEKIT_SIP_HOST'] ?? 'sip.livekit.run';

  if (!twilioSid || !twilioToken || !callerId) {
    void Promise.resolve(admin.rpc('release_call_slot', { p_workspace_id: workspace.id })).catch(() => null);
    await admin.from('campaign_contacts').update({ status: 'invalid' }).eq('id', contact.id);
    return;
  }

  const twimlCallbackUrl = `${appUrl}/api/v1/outbound/twiml?room=${encodeURIComponent(roomName)}&host=${encodeURIComponent(livekitSipHost)}`;
  const twilioParams = new URLSearchParams({
    To: contact.phone, From: callerId,
    Url: twimlCallbackUrl,
    StatusCallback: `${appUrl}/api/webhooks/twilio/status`,
    StatusCallbackMethod: 'POST',
    StatusCallbackEvent: 'completed failed busy no-answer canceled',
    Timeout: '25',
  });

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: twilioParams.toString(),
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}`);
    const { sid } = await res.json() as { sid: string };
    await admin.from('calls').insert({
      workspace_id: workspace.id,
      agent_id: campaign.agent_id,
      campaign_id: campaign.id,
      retell_call_id: roomName,
      direction: 'outbound',
      contact_phone: contact.phone,
      contact_name: contact.name,
      status: 'dialing',
      cost_usd: 0,
      routing_data: { method: 'twilio_twiml', twilio_call_sid: sid, campaign_dial: true },
    });
  } catch {
    void Promise.resolve(admin.rpc('release_call_slot', { p_workspace_id: workspace.id })).catch(() => null);
    await admin.from('campaign_contacts').update({ status: 'no_answer' }).eq('id', contact.id);
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env['CRON_SECRET'];
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const admin = createAdminClient();
  const apiKey    = process.env['LIVEKIT_API_KEY'];
  const apiSecret = process.env['LIVEKIT_API_SECRET'];
  const httpUrl   = getRegionalHttpUrl();

  if (!apiKey || !apiSecret || !httpUrl) {
    return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });
  }

  // Load all active campaigns
  const { data: campaigns } = await admin
    .from('campaigns')
    .select('id, workspace_id, agent_id, max_concurrency, retry_enabled, retry_interval_hours, max_retries')
    .eq('status', 'active');

  if (!campaigns?.length) return NextResponse.json({ ok: true, dialed: 0 });

  let totalDialed = 0;

  for (const campaign of campaigns as CampaignRow[]) {
    if (!campaign.agent_id) continue;

    // ── 1. Reset eligible contacts to pending (retry gate) ──────────────────
    if (campaign.retry_enabled) {
      const retryBefore = new Date(
        Date.now() - campaign.retry_interval_hours * 3_600_000
      ).toISOString();

      await admin
        .from('campaign_contacts')
        .update({ status: 'pending' })
        .eq('campaign_id', campaign.id)
        .in('status', ['no_answer', 'voicemail'])
        .lt('attempts', campaign.max_retries)
        .lt('last_called_at', retryBefore);
    }

    // ── 2. Load workspace for limit checks ──────────────────────────────────
    const { data: ws } = await admin
      .from('workspaces')
      .select('id, minutes_used, minutes_limit, is_suspended')
      .eq('id', campaign.workspace_id)
      .single();

    const workspace = ws as WorkspaceRow | null;
    if (!workspace || workspace.is_suspended) continue;
    if (Number(workspace.minutes_used) >= Number(workspace.minutes_limit)) continue;

    // ── 3. Load agent ────────────────────────────────────────────────────────
    const { data: agentData } = await admin
      .from('agents')
      .select('id, name, system_prompt, first_message, voice_id, voice_emotion, flow_json, flow_config, transfer_number')
      .eq('id', campaign.agent_id)
      .single();
    if (!agentData) continue;
    const agent = agentData as AgentRow;

    // ── 4. Load pending contacts up to concurrency limit ────────────────────
    const { data: contacts } = await admin
      .from('campaign_contacts')
      .select('id, phone, name, variables, attempts')
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending')
      .limit(campaign.max_concurrency);

    if (!contacts?.length) continue;

    // ── 5. Dial in parallel ──────────────────────────────────────────────────
    await Promise.allSettled(
      (contacts as ContactRow[]).map((contact) =>
        dialContact({ admin, workspace, campaign, agent, contact, apiKey, apiSecret, httpUrl })
      )
    );

    totalDialed += contacts.length;
  }

  return NextResponse.json({ ok: true, dialed: totalDialed });
}
