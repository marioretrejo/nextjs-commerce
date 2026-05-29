import { WebhookReceiver, RoomServiceClient } from 'livekit-server-sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { deliverWebhook } from '@/lib/webhooks/deliver';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.text();
  const authHeader = req.headers.get('Authorization') ?? undefined;

  const apiKey = process.env['LIVEKIT_API_KEY'];
  const apiSecret = process.env['LIVEKIT_API_SECRET'];
  if (!apiKey || !apiSecret) return new NextResponse('LiveKit not configured', { status: 500 });

  const receiver = new WebhookReceiver(apiKey, apiSecret);
  let event;
  try {
    event = await receiver.receive(body, authHeader);
  } catch {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const admin = createAdminClient();

  // ─── room_finished ─────────────────────────────────────────────────────────
  if (event.event === 'room_finished') {
    const roomName = event.room?.name ?? '';
    const match = roomName.match(/^(?:agent|sip-agent)-([0-9a-f-]+)-?(\d*)$/i);
    if (!match) return NextResponse.json({ received: true });

    const agentId = match[1]!;
    const roomCreatedAt = Number(match[2] || '0');
    const durationSeconds = roomCreatedAt
      ? Math.max(0, Math.round((Date.now() - roomCreatedAt) / 1000))
      : 0;
    const durationMinutes = durationSeconds / 60;

    const { data: agent } = await admin
      .from('agents')
      .select('workspace_id')
      .eq('id', agentId)
      .single();

    if (!agent) return NextResponse.json({ received: true });
    const workspaceId = (agent as { workspace_id: string }).workspace_id;

    // ── Atomic billing: single UPDATE that increments minutes AND releases the
    // concurrent slot in one round-trip, preventing the race where two
    // simultaneous room_finished events both read a stale minutes_used value.
    const { data: billing } = await admin.rpc('finalize_call_billing', {
      p_workspace_id: workspaceId,
      p_minutes:      durationMinutes,
    });
    const billingRow = (billing as { new_minutes_used: number; minutes_limit: number; is_over_limit: boolean }[] | null)?.[0];

    const costUsd = parseFloat(((durationSeconds / 60) * 0.05).toFixed(4));

    // ── Finalize call record ───────────────────────────────────────────────────
    // Check if a row already exists (created by the dial route).
    // If yes: update only duration/status/cost — preserving the original direction.
    // If no:  insert a new row (fallback for edge cases where the dial route failed).
    const { data: existingCall } = await admin
      .from('calls')
      .select('id')
      .eq('retell_call_id', roomName)
      .maybeSingle();

    if (existingCall) {
      await admin
        .from('calls')
        .update({ duration_seconds: durationSeconds, status: 'completed', cost_usd: costUsd })
        .eq('retell_call_id', roomName);
    } else {
      await admin.from('calls').insert({
        workspace_id: workspaceId,
        agent_id: agentId,
        retell_call_id: roomName,
        direction: 'inbound',
        duration_seconds: durationSeconds,
        status: 'completed',
        cost_usd: costUsd,
      });
    }

    await Promise.allSettled([
      // ── Agent total_calls counter ───────────────────────────────────────────
      admin.rpc('increment_agent_total_calls', { p_agent_id: agentId }),
    ]);

    // If the atomic billing detected a limit breach, log it so the admin can
    // see which call pushed the workspace over the edge.
    if (billingRow?.is_over_limit) {
      void Promise.resolve(
        admin.from('workspace_events').insert({
          workspace_id: workspaceId,
          event_type: 'limit_reached',
          details: {
            room_name: roomName,
            new_minutes_used: billingRow.new_minutes_used,
            minutes_limit: billingRow.minutes_limit,
            duration_minutes: durationMinutes,
          },
        })
      ).catch(() => null);
    }

    // ── Async post-call analysis (non-blocking) ─────────────────────────────
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'];
    const internalSecret = process.env['INTERNAL_API_SECRET'];
    if (appUrl && internalSecret) {
      fetch(`${appUrl}/api/jobs/analyze-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': internalSecret },
        body: JSON.stringify({ room_name: roomName }),
      }).catch(() => null);
    }

    // ── Customer webhook dispatch: call.completed ───────────────────────────
    // Fired after call ends — lets B2B clients pipe data to Zapier, HubSpot, etc.
    deliverWebhook(workspaceId, 'call.completed', {
      room_name: roomName,
      agent_id: agentId,
      duration_seconds: durationSeconds,
      workspace_id: workspaceId,
    }).catch(() => null);
  }

  // ─── egress_ended ──────────────────────────────────────────────────────────
  if (event.event === 'egress_ended') {
    const egressInfo = event.egressInfo;
    const roomName = egressInfo?.roomName ?? '';
    const match = roomName.match(/^(?:agent|sip-agent)-([0-9a-f-]+)/i);
    if (!match) return NextResponse.json({ received: true });

    const recordingUrl = egressInfo?.fileResults?.[0]?.location ?? null;
    if (recordingUrl) {
      const { data: calls } = await admin
        .from('calls')
        .select('id')
        .eq('retell_call_id', roomName)
        .limit(1);
      const callId = (calls as { id: string }[] | null)?.[0]?.id;
      if (callId) {
        await admin.from('calls').update({ recording_url: recordingUrl }).eq('id', callId);
      }
    }
  }

  // ─── Kill switch: mid-call balance check ──────────────────────────────────
  // If a workspace runs out of minutes DURING an active call, forcibly end the room.
  // Triggered by checking after each room_started event.
  if (event.event === 'room_started') {
    const roomName = event.room?.name ?? '';
    const match = roomName.match(/^(?:agent|sip-agent)-([0-9a-f-]+)/i);
    if (!match) return NextResponse.json({ received: true });

    const agentId = match[1]!;
    const { data: agent } = await admin
      .from('agents')
      .select('workspace_id')
      .eq('id', agentId)
      .single();

    if (agent) {
      const workspaceId = (agent as { workspace_id: string }).workspace_id;
      const { data: ws } = await admin
        .from('workspaces')
        .select('minutes_used, minutes_limit')
        .eq('id', workspaceId)
        .single();

      // If workspace is already at 100%, kill the room before it consumes more API credits
      if (ws && Number((ws as { minutes_used: number }).minutes_used) >= Number((ws as { minutes_limit: number }).minutes_limit)) {
        const wsUrl = process.env['LIVEKIT_URL'] ?? '';
        const httpUrl = wsUrl.replace('wss://', 'https://');
        const lkApiKey = process.env['LIVEKIT_API_KEY'];
        const lkApiSecret = process.env['LIVEKIT_API_SECRET'];

        if (httpUrl && lkApiKey && lkApiSecret) {
          const roomService = new RoomServiceClient(httpUrl, lkApiKey, lkApiSecret);
          // Delete the room — the worker detects disconnection and plays a goodbye
          roomService.deleteRoom(roomName).catch(() => null);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
