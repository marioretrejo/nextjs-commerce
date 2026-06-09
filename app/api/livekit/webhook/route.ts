/**
 * LiveKit Server Webhook
 * Receives room lifecycle events from LiveKit Cloud and keeps the
 * workspace's active_calls counter in sync.
 *
 * Configure in LiveKit Cloud dashboard → Project → Webhooks:
 *   URL: https://voiceos-app.onrender.com/api/livekit/webhook
 *   Events: room_finished (at minimum)
 */
import { WebhookReceiver } from "livekit-server-sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const apiKey = process.env["LIVEKIT_API_KEY"] ?? "";
const apiSecret = process.env["LIVEKIT_API_SECRET"] ?? "";

export async function POST(req: Request) {
  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "LiveKit not configured" },
      { status: 500 },
    );
  }

  const body = await req.text();
  const authHeader = req.headers.get("Authorization") ?? "";

  let event: Awaited<ReturnType<WebhookReceiver["receive"]>>;
  try {
    const receiver = new WebhookReceiver(apiKey, apiSecret);
    event = await receiver.receive(body, authHeader);
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  }

  // Only act on room_finished — this is the guaranteed cleanup point regardless
  // of whether the call succeeded, failed, or the worker crashed.
  if (event.event === "room_finished" && event.room) {
    const meta = (() => {
      try {
        return JSON.parse(event.room.metadata ?? "{}") as Record<
          string,
          unknown
        >;
      } catch {
        return {};
      }
    })();

    const workspaceId = meta["workspace_id"] as string | undefined;
    if (workspaceId) {
      const admin = createAdminClient();
      // release_call_slot decrements active_calls by 1, floor 0
      await admin
        .rpc("release_call_slot", { p_workspace_id: workspaceId })
        .then(
          () => null,
          () => null,
        );
    }
  }

  return NextResponse.json({ ok: true });
}
