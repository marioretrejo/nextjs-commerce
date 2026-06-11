/**
 * POST /api/webhooks/twilio/status
 *
 * Receives Twilio call status callbacks (completed, failed, no-answer, busy, canceled).
 * Updates technical_status, ended_at, answered_at, duration_seconds, end_reason,
 * releases call slots for terminal statuses, and updates campaign_contacts.
 *
 * NOTE: post_call_jobs are NOT created here. The voice worker close handler is
 * the authoritative creator of post_call_jobs (it has evidence of a real session).
 * The recovery runner creates jobs for orphaned calls only when call_events confirm
 * real agent/voice activity.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateTwilioRequest,
  shouldValidateTwilio,
} from "@/lib/twilio/validate";
import { recordCallEvent } from "@/agent/persistence/call-events-repository";
import { NextResponse } from "next/server";

interface CallRow {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  campaign_id: string | null;
  retell_call_id: string | null;
  contact_phone: string | null;
  routing_data: Record<string, unknown>;
  technical_status: string | null;
  ended_at: string | null;
  answered_at: string | null;
}

function mapStatus(twilio: string): {
  technicalStatus: string;
  legacyStatus: string;
  isTerminal: boolean;
  endReason?: string;
} {
  switch (twilio) {
    case "queued":
    case "initiated":
      return {
        technicalStatus: "initiated",
        legacyStatus: "initiated",
        isTerminal: false,
      };
    case "ringing":
      return {
        technicalStatus: "ringing",
        legacyStatus: "ringing",
        isTerminal: false,
      };
    case "in-progress":
      return {
        technicalStatus: "in_progress",
        legacyStatus: "in-progress",
        isTerminal: false,
      };
    case "completed":
      return {
        technicalStatus: "completed",
        legacyStatus: "completed",
        isTerminal: true,
      };
    case "no-answer":
      return {
        technicalStatus: "no_answer",
        legacyStatus: "no_answer",
        isTerminal: true,
        endReason: "twilio_no_answer",
      };
    case "busy":
      return {
        technicalStatus: "busy",
        legacyStatus: "failed",
        isTerminal: true,
      };
    case "failed":
      return {
        technicalStatus: "failed",
        legacyStatus: "failed",
        isTerminal: true,
      };
    case "canceled":
    case "cancelled":
      return {
        technicalStatus: "cancelled",
        legacyStatus: "cancelled",
        isTerminal: true,
      };
    default:
      return {
        technicalStatus: "failed",
        legacyStatus: "failed",
        isTerminal: true,
      };
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const reqUrl = new URL(req.url);
  // Use the actual request origin so HMAC validation matches regardless of which
  // Vercel URL (deployment hash vs branch alias) Twilio used to reach this route.
  const appUrl = reqUrl.origin;

  if (shouldValidateTwilio()) {
    const valid = validateTwilioRequest(req, body, appUrl, reqUrl.pathname);
    if (!valid) return new NextResponse("Forbidden", { status: 403 });
  }

  const params = Object.fromEntries(new URLSearchParams(body));
  const callSid = params["CallSid"] ?? "";
  const callStatus = params["CallStatus"] ?? "";
  const callDuration = Number(params["CallDuration"] ?? "0");
  const answeredBy = params["AnsweredBy"] ?? "";

  if (!callSid) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  let callRow: CallRow | undefined;

  try {
    const { data: calls } = await admin
      .from("calls")
      .select(
        "id, workspace_id, agent_id, campaign_id, retell_call_id, contact_phone, routing_data, technical_status, ended_at, answered_at",
      )
      .contains("routing_data", { twilio_call_sid: callSid })
      .limit(1);

    callRow = (calls as CallRow[] | null)?.[0];
    if (!callRow) return NextResponse.json({ ok: true });

    const callRoom = callRow.retell_call_id ?? callSid;
    const now = new Date().toISOString();

    void recordCallEvent(
      admin,
      callRoom,
      callRow.workspace_id,
      "telephony.status_callback_received",
      {
        twilio_call_sid: callSid,
        call_status: callStatus,
        ...(answeredBy ? { answered_by: answeredBy } : {}),
      },
    );

    // AMD machine detection: cancel call if machine detected and amd_action=hangup
    const isMachine = answeredBy.startsWith("machine_") || answeredBy === "fax";
    if (isMachine && callRow.routing_data?.["amd_action"] === "hangup") {
      const twilioSid = process.env["TWILIO_ACCOUNT_SID"];
      const twilioToken = process.env["TWILIO_AUTH_TOKEN"];
      if (twilioSid && twilioToken) {
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls/${callSid}.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ Status: "completed" }).toString(),
          },
        ).catch(() => null);
      }

      if (!callRow.ended_at) {
        await admin
          .from("calls")
          .update({
            technical_status: "cancelled",
            status: "cancelled",
            ended_at: now,
            duration_seconds: 0,
            end_reason: "amd_machine_hangup",
          })
          .eq("id", callRow.id);

        void Promise.resolve(
          admin.rpc("release_call_slot", {
            p_workspace_id: callRow.workspace_id,
          }),
        ).catch(() => null);

        if (callRow.campaign_id && callRow.contact_phone) {
          void admin
            .from("campaign_contacts")
            .update({ status: "no_answer" })
            .eq("campaign_id", callRow.campaign_id)
            .eq("phone", callRow.contact_phone)
            .eq("status", "calling")
            .then(
              () => null,
              () => null,
            );
        }

        void recordCallEvent(
          admin,
          callRoom,
          callRow.workspace_id,
          "call.ended",
          {
            twilio_call_sid: callSid,
            technical_status: "cancelled",
            end_reason: "amd_machine_hangup",
          },
        );
      }

      void recordCallEvent(
        admin,
        callRoom,
        callRow.workspace_id,
        "telephony.status_callback_processed",
        { twilio_call_sid: callSid, call_status: callStatus, path: "amd" },
      );
      return NextResponse.json({ ok: true });
    }

    const { technicalStatus, legacyStatus, isTerminal, endReason } =
      mapStatus(callStatus);

    // Idempotency: terminal callback on an already-ended call — only refresh duration
    if (callRow.ended_at && isTerminal) {
      if (callDuration > 0) {
        await admin
          .from("calls")
          .update({ duration_seconds: callDuration })
          .eq("id", callRow.id);
      }
      void recordCallEvent(
        admin,
        callRoom,
        callRow.workspace_id,
        "telephony.status_callback_processed",
        {
          twilio_call_sid: callSid,
          call_status: callStatus,
          path: "idempotent",
        },
      );
      return NextResponse.json({ ok: true });
    }

    // Non-terminal: update in-progress state
    if (!isTerminal) {
      const update: Record<string, unknown> = {
        technical_status: technicalStatus,
        status: legacyStatus,
      };
      if (technicalStatus === "in_progress" && !callRow.answered_at) {
        update["answered_at"] = now;
      }
      await admin.from("calls").update(update).eq("id", callRow.id);

      if (technicalStatus === "in_progress") {
        void recordCallEvent(
          admin,
          callRoom,
          callRow.workspace_id,
          "call.answered",
          {
            twilio_call_sid: callSid,
            ...(answeredBy ? { answered_by: answeredBy } : {}),
          },
        );
      }

      void recordCallEvent(
        admin,
        callRoom,
        callRow.workspace_id,
        "telephony.status_callback_processed",
        {
          twilio_call_sid: callSid,
          call_status: callStatus,
          path: "non_terminal",
        },
      );
      return NextResponse.json({ ok: true });
    }

    // Terminal: full update
    const terminalUpdate: Record<string, unknown> = {
      technical_status: technicalStatus,
      status: legacyStatus,
      ended_at: now,
      duration_seconds: callDuration,
    };
    if (endReason) terminalUpdate["end_reason"] = endReason;

    await admin.from("calls").update(terminalUpdate).eq("id", callRow.id);

    // Release active_calls slot (idempotent RPC handles double-release safely)
    void Promise.resolve(
      admin.rpc("release_call_slot", { p_workspace_id: callRow.workspace_id }),
    ).catch(() => null);

    // Update campaign_contacts for non-completed terminals; completed is handled by post-call jobs
    if (
      callRow.campaign_id &&
      callRow.contact_phone &&
      technicalStatus !== "completed"
    ) {
      void admin
        .from("campaign_contacts")
        .update({ status: "no_answer" })
        .eq("campaign_id", callRow.campaign_id)
        .eq("phone", callRow.contact_phone)
        .eq("status", "calling")
        .then(
          () => null,
          () => null,
        );
    }

    void recordCallEvent(admin, callRoom, callRow.workspace_id, "call.ended", {
      twilio_call_sid: callSid,
      technical_status: technicalStatus,
      duration_seconds: callDuration,
      ...(endReason ? { end_reason: endReason } : {}),
    });

    void recordCallEvent(
      admin,
      callRoom,
      callRow.workspace_id,
      "telephony.status_callback_processed",
      {
        twilio_call_sid: callSid,
        call_status: callStatus,
        technical_status: technicalStatus,
        path: "terminal",
      },
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[twilio-status] unexpected error:", err);
    if (callRow) {
      void recordCallEvent(
        admin,
        callRow.retell_call_id ?? callSid,
        callRow.workspace_id,
        "telephony.status_callback_failed",
        {
          twilio_call_sid: callSid,
          call_status: callStatus,
          error: String(err),
        },
      );
    }
    // Always return 200 so Twilio does not retry on application errors
    return NextResponse.json({ ok: true });
  }
}
