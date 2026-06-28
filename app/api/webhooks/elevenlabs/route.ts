import { createAdminClient } from "@/lib/supabase/admin";
import { updateWorkspaceMinutes } from "@/lib/updateWorkspaceMinutes";
import { NextResponse } from "next/server";
import crypto from "crypto";

interface ElevenLabsCallEvent {
  event_type?: string;
  call_id?: string;
  agent_id?: string;
  duration_secs?: number;
  metadata?: Record<string, unknown>;
}

function verifySignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  // Fail closed: without a configured secret the webhook is unauthenticated and
  // anyone could POST forged `call_ended` events to inflate a tenant's usage.
  const secret = process.env["ELEVENLABS_WEBHOOK_SECRET"];
  if (!secret) {
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }
  const signature = req.headers.get("elevenlabs-signature") ?? "";
  if (!signature || !verifySignature(rawBody, signature, secret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const body = JSON.parse(rawBody) as ElevenLabsCallEvent;

  if (body.event_type === "call_ended" && body.agent_id && body.duration_secs) {
    const admin = createAdminClient();

    // Idempotency: bill each call_id at most once (ElevenLabs may retry).
    if (body.call_id) {
      const { error: dedupErr } = await admin
        .from("processed_webhook_events")
        .insert({ provider: "elevenlabs_billing", event_id: body.call_id });
      if (dedupErr) {
        return NextResponse.json({
          received: true,
          duplicate: (dedupErr as { code?: string }).code === "23505",
        });
      }
    }

    const { data: agent } = await admin
      .from("agents")
      .select("id, workspace_id")
      .eq("elevenlabs_agent_id", body.agent_id)
      .maybeSingle();

    if (agent) {
      const agentRow = agent as { id: string; workspace_id: string };
      await updateWorkspaceMinutes(agentRow.workspace_id, body.duration_secs);
    }
  }

  return NextResponse.json({ received: true });
}
