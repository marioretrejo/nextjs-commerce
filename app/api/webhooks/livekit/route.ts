import { WebhookReceiver } from 'livekit-server-sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// Next.js must receive the raw body to verify the HMAC signature
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.text();
  const authHeader = req.headers.get('Authorization') ?? undefined;

  const apiKey = process.env['LIVEKIT_API_KEY'];
  const apiSecret = process.env['LIVEKIT_API_SECRET'];
  if (!apiKey || !apiSecret) {
    return new NextResponse('LiveKit not configured', { status: 500 });
  }

  const receiver = new WebhookReceiver(apiKey, apiSecret);
  let event;
  try {
    event = await receiver.receive(body, authHeader);
  } catch {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const admin = createAdminClient();

  if (event.event === 'room_finished') {
    const roomName = event.room?.name ?? '';
    // Room names follow the pattern: agent-{agentId}-{timestamp}
    const match = roomName.match(/^agent-([0-9a-f-]+)-(\d+)$/i);
    if (!match) return NextResponse.json({ received: true });

    const agentId = match[1]!;
    const roomCreatedAt = Number(match[2]!); // timestamp embedded in room name (ms)

    // Calculate duration in seconds from the room name timestamp to now
    const durationSeconds = Math.max(0, Math.round((Date.now() - roomCreatedAt) / 1000));
    const durationMinutes = durationSeconds / 60;

    // Fetch agent to resolve workspace_id
    const { data: agent } = await admin
      .from('agents')
      .select('workspace_id')
      .eq('id', agentId)
      .single();

    if (!agent) return NextResponse.json({ received: true });
    const workspaceId = (agent as { workspace_id: string }).workspace_id;

    // Atomically update minutes_used — try RPC first, fall back to manual arithmetic
    try {
      const { error } = await admin.rpc('increment_workspace_minutes', {
        p_workspace_id: workspaceId,
        p_minutes: durationMinutes,
      });
      if (error) throw error;
    } catch {
      // RPC not available — manual read-modify-write
      const { data: ws } = await admin
        .from('workspaces')
        .select('minutes_used')
        .eq('id', workspaceId)
        .single();
      const current = Number((ws as { minutes_used: number } | null)?.minutes_used ?? 0);
      await admin
        .from('workspaces')
        .update({ minutes_used: current + durationMinutes })
        .eq('id', workspaceId);
    }

    // Insert call record for the dashboard history
    await admin.from('calls').insert({
      workspace_id: workspaceId,
      agent_id: agentId,
      direction: 'inbound',
      duration_seconds: durationSeconds,
      status: 'completed',
      cost_usd: 0,
    });

    // Increment the agent's total_calls counter
    try {
      const { error } = await admin.rpc('increment_agent_total_calls', { p_agent_id: agentId });
      if (error) throw error;
    } catch {
      const { data: a } = await admin
        .from('agents')
        .select('total_calls')
        .eq('id', agentId)
        .single();
      const current = Number((a as { total_calls: number } | null)?.total_calls ?? 0);
      await admin.from('agents').update({ total_calls: current + 1 }).eq('id', agentId);
    }
  }

  if (event.event === 'egress_ended') {
    // When LiveKit Egress finishes, store the recording URL in the call record
    const egressInfo = event.egressInfo;
    const roomName = egressInfo?.roomName ?? '';
    const match = roomName.match(/^agent-([0-9a-f-]+)-\d+$/i);
    if (!match) return NextResponse.json({ received: true });

    const agentId = match[1]!;
    // FileInfo.location is the S3/GCS/local storage URL of the recorded file
    const fileResults = egressInfo?.fileResults ?? [];
    const recordingUrl = fileResults[0]?.location ?? null;

    if (recordingUrl) {
      // Update the most recent call record for this agent with the recording URL
      const { data: calls } = await admin
        .from('calls')
        .select('id')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(1);

      const callId = (calls as { id: string }[] | null)?.[0]?.id;
      if (callId) {
        await admin.from('calls').update({ recording_url: recordingUrl }).eq('id', callId);
      }
    }
  }

  return NextResponse.json({ received: true });
}
