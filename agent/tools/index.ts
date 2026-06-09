/**
 * VoiceOS Tool Registry — Enterprise Edition
 *
 * Each tool:
 *   - Fires a contingency phrase via session.say() before awaiting async work
 *   - Has a hard timeout so a slow API never blocks the conversation
 *   - Returns a structured result the LLM uses to compose its reply
 *
 * To add a custom tool: define it, export from buildTools().
 * Parameters use raw JSON Schema — no Zod required.
 */
import { llm } from "@livekit/agents";
import { SipClient, RoomServiceClient } from "livekit-server-sdk";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolOpts = Parameters<llm.FunctionTool<any>["execute"]>[1];

/** Context injected at call start — provides room/SIP coordinates for transfer. */
export interface ToolConfig {
  enableTransfer?: boolean;
  enableOrders?: boolean;
  roomName?: string;
  transferNumber?: string | null; // E.164 number or sip: URI for human hand-off
  livekitWsUrl?: string;
  livekitApiKey?: string;
  livekitApiSecret?: string;
  // Twilio credentials for call-redirect (alternative to SIP REFER)
  twilioCallSid?: string | null;
  twilioAccountSid?: string | null;
  twilioAuthToken?: string | null;
  // Callback fired when a transfer is successfully initiated so the worker
  // can update business_outcome and clean up the session
  onTransferInitiated?: (opts: {
    reason: string;
    targetNumber: string;
  }) => void;
}

const TOOL_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Tool timed out after ${ms}ms`)), ms),
    ),
  ]);
}

// ─── check_availability ────────────────────────────────────────────────────────

const checkAvailability = llm.tool({
  description:
    "Check available appointment slots for the next 5 business days. Call this before offering times to the user.",
  parameters: {
    type: "object" as const,
    properties: {
      service_type: {
        type: "string",
        description:
          'Type of service or meeting (e.g. "demo", "consultation", "support")',
      },
      preferred_date: {
        type: "string",
        description:
          'User\'s preferred date in YYYY-MM-DD format, or "any" if flexible',
      },
    },
    required: ["service_type"],
  },
  execute: async (
    args: { service_type: string; preferred_date?: string },
    opts: ToolOpts,
  ) => {
    opts.ctx.session.say(
      "Let me check the available slots for you, just one moment.",
    );
    try {
      return await withTimeout(
        Promise.resolve(
          getMockAvailability(args.service_type, args.preferred_date),
        ),
        TOOL_TIMEOUT_MS,
      );
    } catch {
      return {
        error:
          "Unable to retrieve availability right now. Someone will follow up.",
      };
    }
  },
});

function getMockAvailability(serviceType: string, preferredDate?: string) {
  const base =
    preferredDate && preferredDate !== "any"
      ? new Date(preferredDate)
      : new Date();
  const slots: string[] = [];
  for (let d = 0; d < 5; d++) {
    const day = new Date(base);
    day.setDate(base.getDate() + d + 1);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    const dateStr = day.toISOString().split("T")[0]!;
    slots.push(
      `${dateStr} at 10:00 AM`,
      `${dateStr} at 2:00 PM`,
      `${dateStr} at 4:00 PM`,
    );
  }
  return { available_slots: slots.slice(0, 6), service_type: serviceType };
}

// ─── book_appointment ──────────────────────────────────────────────────────────

const bookAppointment = llm.tool({
  description:
    "Book an appointment after the user confirms a specific date and time. Always confirm the slot verbally before calling this.",
  parameters: {
    type: "object" as const,
    properties: {
      date: {
        type: "string",
        description: "Appointment date in YYYY-MM-DD format",
      },
      time: { type: "string", description: 'Appointment time, e.g. "2:00 PM"' },
      name: { type: "string", description: "Full name of the person booking" },
      email: {
        type: "string",
        description: "Contact email for the booking confirmation",
      },
      service_type: {
        type: "string",
        description: "Type of appointment or service",
      },
      notes: { type: "string", description: "Any additional notes" },
    },
    required: ["date", "time", "name", "service_type"],
  },
  execute: async (
    args: {
      date: string;
      time: string;
      name: string;
      email?: string;
      service_type: string;
      notes?: string;
    },
    opts: ToolOpts,
  ) => {
    opts.ctx.session.say(
      "Perfect, I'm confirming that booking for you right now.",
    );
    try {
      return await withTimeout(
        Promise.resolve(createMockBooking(args)),
        TOOL_TIMEOUT_MS,
      );
    } catch {
      return {
        error: "Booking failed. Our team will follow up to confirm manually.",
      };
    }
  },
});

function createMockBooking(params: {
  date: string;
  time: string;
  name: string;
  email?: string;
  service_type: string;
  notes?: string;
}) {
  const code = `VOPS-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  return {
    success: true,
    confirmation_code: code,
    ...params,
    message: `Appointment confirmed for ${params.name} on ${params.date} at ${params.time}.`,
  };
}

// ─── transfer_to_human ─────────────────────────────────────────────────────────
//
// Feature 3: Real SIP REFER transfer.
//
// When this tool is invoked:
//   1. Agent speaks the transfer announcement immediately (non-blocking)
//   2. Discovers any SIP participant in the current room via RoomServiceClient
//   3. Issues a SIP REFER to the support number via SipClient.transferSipParticipant
//      — this hands the PSTN call to the support agent and removes AI from the loop
//   4. For WebRTC-only calls (no SIP participant): logs the request and returns a
//      graceful response so the LLM can tell the user what happened

function buildTransferToHuman(config: ToolConfig) {
  return llm.tool({
    description:
      "Transfer the call to a live human agent or specialist. Use when: the user explicitly asks for a human, the issue is too complex, or it cannot be resolved after 2 attempts. Call this tool instead of trying to resolve the issue yourself.",
    parameters: {
      type: "object" as const,
      properties: {
        reason: {
          type: "string",
          description:
            "Brief reason for the transfer (e.g. 'customer_request', 'complaint', 'complex_query')",
        },
        urgency: {
          type: "string",
          enum: ["low", "normal", "high"],
          description: "Urgency level of the request",
        },
      },
      required: ["reason"],
    },
    execute: async (
      args: { reason: string; urgency?: string },
      opts: ToolOpts,
    ) => {
      const {
        roomName,
        transferNumber,
        livekitWsUrl,
        livekitApiKey,
        livekitApiSecret,
        twilioCallSid,
        twilioAccountSid,
        twilioAuthToken,
        onTransferInitiated,
      } = config;

      const targetNumber = transferNumber ?? null;

      if (!targetNumber) {
        console.warn(
          "[transfer_to_human] No transfer number configured — logging escalation only",
        );
        opts.ctx.session.say(
          "I'm sorry, our transfer service is temporarily unavailable. A team member will call you back shortly.",
        );
        return {
          transfer_initiated: false,
          reason: args.reason,
          message:
            "Transfer service unavailable. A team member will call back.",
        };
      }

      // Announce the transfer immediately so the user hears feedback
      opts.ctx.session.say(
        "Por favor espere un momento, estoy transfiriendo su llamada con un especialista.",
      );

      // ── Strategy 1: Twilio call-redirect (preferred for Twilio-originated calls) ─
      if (twilioCallSid && twilioAccountSid && twilioAuthToken) {
        try {
          const twiml = `<Response><Dial>${targetNumber}</Dial></Response>`;
          const res = await withTimeout(
            fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls/${twilioCallSid}.json`,
              {
                method: "POST",
                headers: {
                  Authorization: `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64")}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({ Twiml: twiml }).toString(),
              },
            ),
            TOOL_TIMEOUT_MS,
          );

          if (res.ok) {
            console.log(
              `[transfer_to_human] Twilio redirect sent to ${targetNumber} (SID: ${twilioCallSid})`,
            );
            // Notify worker so it can update lifecycle + interrupt session
            onTransferInitiated?.({ reason: args.reason, targetNumber });
            return {
              transfer_initiated: true,
              transfer_type: "twilio_redirect",
              destination: targetNumber,
              reason: args.reason,
              urgency: args.urgency ?? "normal",
            };
          }

          // Twilio rejected the redirect — fall through to SIP REFER
          console.warn(
            `[transfer_to_human] Twilio redirect failed (${res.status}), trying SIP REFER`,
          );
        } catch (twilioErr) {
          console.warn(
            "[transfer_to_human] Twilio redirect threw, trying SIP REFER:",
            String(twilioErr),
          );
        }
      }

      // ── Strategy 2: SIP REFER via LiveKit ────────────────────────────────────
      if (roomName && livekitApiKey && livekitApiSecret && livekitWsUrl) {
        try {
          const httpUrl = livekitWsUrl
            .replace("wss://", "https://")
            .replace("ws://", "http://");

          const roomService = new RoomServiceClient(
            httpUrl,
            livekitApiKey,
            livekitApiSecret,
          );

          const participants = await withTimeout(
            roomService.listParticipants(roomName),
            5000,
          );

          const sipParticipant = participants.find(
            (p) => p.identity?.startsWith("sip_") || p.kind === 3,
          );

          if (sipParticipant?.identity) {
            const sipClient = new SipClient(
              httpUrl,
              livekitApiKey,
              livekitApiSecret,
            );

            const transferTo = targetNumber.startsWith("sip:")
              ? targetNumber
              : `sip:${targetNumber.replace("+", "")}@sip.twilio.com`;

            await withTimeout(
              sipClient.transferSipParticipant(
                roomName,
                sipParticipant.identity,
                transferTo,
              ),
              8000,
            );

            console.log(
              `[transfer_to_human] SIP REFER sent to ${transferTo} for ${sipParticipant.identity}`,
            );
            onTransferInitiated?.({ reason: args.reason, targetNumber });
            return {
              transfer_initiated: true,
              transfer_type: "sip_refer",
              destination: transferTo,
              reason: args.reason,
              urgency: args.urgency ?? "normal",
            };
          }

          console.warn(
            "[transfer_to_human] No SIP participant found; cannot issue REFER",
          );
        } catch (sipErr) {
          console.error("[transfer_to_human] SIP REFER failed:", sipErr);
        }
      }

      // ── Strategy 3: Both transfer methods failed — graceful fallback ─────────
      opts.ctx.session.say(
        "En este momento todos nuestros especialistas están ocupados. Por favor llame de nuevo en unos minutos.",
      );
      return {
        transfer_initiated: false,
        reason: args.reason,
        message:
          "All specialists are currently busy. Please call back in a few minutes.",
      };
    },
  });
}

// ─── check_order_status ────────────────────────────────────────────────────────

const checkOrderStatus = llm.tool({
  description:
    "Look up the status of a customer order or support ticket by its ID.",
  parameters: {
    type: "object" as const,
    properties: {
      order_id: {
        type: "string",
        description: "Order or ticket ID provided by the customer",
      },
      customer_email: {
        type: "string",
        description: "Customer email to verify identity (optional)",
      },
    },
    required: ["order_id"],
  },
  execute: async (
    args: { order_id: string; customer_email?: string },
    opts: ToolOpts,
  ) => {
    opts.ctx.session.say("Give me just a second while I pull that up.");
    try {
      return await withTimeout(
        Promise.resolve(getMockOrderStatus(args.order_id)),
        TOOL_TIMEOUT_MS,
      );
    } catch {
      return {
        error:
          "Unable to retrieve order status. Please check the website or contact support.",
      };
    }
  },
});

function getMockOrderStatus(orderId: string) {
  const statuses = ["processing", "shipped", "delivered", "cancelled"] as const;
  const status = statuses[orderId.length % statuses.length]!;
  return {
    order_id: orderId,
    status,
    estimated_delivery: status === "shipped" ? "2 business days" : null,
    tracking_number:
      status === "shipped" ? `TRK-${orderId.toUpperCase()}` : null,
  };
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export function buildTools(config: ToolConfig = {}): llm.ToolContext {
  return {
    check_availability: checkAvailability,
    book_appointment: bookAppointment,
    ...(config.enableTransfer !== false
      ? { transfer_to_human: buildTransferToHuman(config) }
      : {}),
    ...(config.enableOrders ? { check_order_status: checkOrderStatus } : {}),
  };
}
