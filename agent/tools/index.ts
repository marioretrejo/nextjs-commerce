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
import { llm } from '@livekit/agents';
import { SipClient, RoomServiceClient } from 'livekit-server-sdk';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolOpts = Parameters<llm.FunctionTool<any>['execute']>[1];

/** Context injected at call start — provides room/SIP coordinates for transfer. */
export interface ToolConfig {
  enableTransfer?: boolean;
  enableOrders?: boolean;
  roomName?: string;
  transferNumber?: string | null;  // E.164: "+18005551234"
  livekitWsUrl?: string;
  livekitApiKey?: string;
  livekitApiSecret?: string;
}

const TOOL_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Tool timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// ─── check_availability ────────────────────────────────────────────────────────

const checkAvailability = llm.tool({
  description:
    'Check available appointment slots for the next 5 business days. Call this before offering times to the user.',
  parameters: {
    type: 'object' as const,
    properties: {
      service_type: {
        type: 'string',
        description: 'Type of service or meeting (e.g. "demo", "consultation", "support")',
      },
      preferred_date: {
        type: 'string',
        description: 'User\'s preferred date in YYYY-MM-DD format, or "any" if flexible',
      },
    },
    required: ['service_type'],
  },
  execute: async (args: { service_type: string; preferred_date?: string }, opts: ToolOpts) => {
    opts.ctx.session.say('Let me check the available slots for you, just one moment.');
    try {
      return await withTimeout(
        Promise.resolve(getMockAvailability(args.service_type, args.preferred_date)),
        TOOL_TIMEOUT_MS
      );
    } catch {
      return { error: 'Unable to retrieve availability right now. Someone will follow up.' };
    }
  },
});

function getMockAvailability(serviceType: string, preferredDate?: string) {
  const base = preferredDate && preferredDate !== 'any' ? new Date(preferredDate) : new Date();
  const slots: string[] = [];
  for (let d = 0; d < 5; d++) {
    const day = new Date(base);
    day.setDate(base.getDate() + d + 1);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    const dateStr = day.toISOString().split('T')[0]!;
    slots.push(`${dateStr} at 10:00 AM`, `${dateStr} at 2:00 PM`, `${dateStr} at 4:00 PM`);
  }
  return { available_slots: slots.slice(0, 6), service_type: serviceType };
}

// ─── book_appointment ──────────────────────────────────────────────────────────

const bookAppointment = llm.tool({
  description:
    'Book an appointment after the user confirms a specific date and time. Always confirm the slot verbally before calling this.',
  parameters: {
    type: 'object' as const,
    properties: {
      date: { type: 'string', description: 'Appointment date in YYYY-MM-DD format' },
      time: { type: 'string', description: 'Appointment time, e.g. "2:00 PM"' },
      name: { type: 'string', description: 'Full name of the person booking' },
      email: { type: 'string', description: 'Contact email for the booking confirmation' },
      service_type: { type: 'string', description: 'Type of appointment or service' },
      notes: { type: 'string', description: 'Any additional notes' },
    },
    required: ['date', 'time', 'name', 'service_type'],
  },
  execute: async (
    args: { date: string; time: string; name: string; email?: string; service_type: string; notes?: string },
    opts: ToolOpts
  ) => {
    opts.ctx.session.say('Perfect, I\'m confirming that booking for you right now.');
    try {
      return await withTimeout(Promise.resolve(createMockBooking(args)), TOOL_TIMEOUT_MS);
    } catch {
      return { error: 'Booking failed. Our team will follow up to confirm manually.' };
    }
  },
});

function createMockBooking(params: {
  date: string; time: string; name: string;
  email?: string; service_type: string; notes?: string;
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
      'Transfer the call to a live human agent. Use when: user explicitly asks for a human, the issue is too complex, or it cannot be resolved after 2 attempts.',
    parameters: {
      type: 'object' as const,
      properties: {
        reason: { type: 'string', description: 'Brief reason for the transfer (used for routing)' },
        urgency: {
          type: 'string',
          enum: ['low', 'normal', 'high'],
          description: 'Urgency level of the request',
        },
      },
      required: ['reason'],
    },
    execute: async (args: { reason: string; urgency?: string }, opts: ToolOpts) => {
      // Speak immediately so the user hears something while the transfer completes
      opts.ctx.session.say(
        'Of course. I\'m transferring your call to one of our team members right now. Please hold on for just a moment.'
      );

      const {
        roomName, transferNumber,
        livekitWsUrl, livekitApiKey, livekitApiSecret,
      } = config;

      if (!roomName || !transferNumber || !livekitApiKey || !livekitApiSecret || !livekitWsUrl) {
        // WebRTC call or SIP not configured — graceful degradation
        console.warn('[transfer_to_human] SIP transfer not configured; logging escalation only');
        return {
          transfer_initiated: false,
          reason: args.reason,
          urgency: args.urgency ?? 'normal',
          message: 'A team member will call you back shortly.',
        };
      }

      try {
        const httpUrl = livekitWsUrl
          .replace('wss://', 'https://')
          .replace('ws://', 'http://');

        const roomService = new RoomServiceClient(httpUrl, livekitApiKey, livekitApiSecret);

        // Find the SIP participant in the current room (the caller on PSTN)
        const participants = await withTimeout(
          roomService.listParticipants(roomName),
          5000
        );

        const sipParticipant = participants.find(
          (p) => p.identity?.startsWith('sip_') || p.kind === 3 // ParticipantInfo_Kind.SIP = 3
        );

        if (sipParticipant?.identity) {
          // Issue SIP REFER — the telephony carrier bridges the call to the support number.
          // The AI participant stays in the room until LiveKit removes it, but the user
          // is already talking to the human agent. Session.Close fires shortly after.
          const sipClient = new SipClient(httpUrl, livekitApiKey, livekitApiSecret);

          // SIP URI for the support number (Twilio-style)
          const transferTo = transferNumber.startsWith('sip:')
            ? transferNumber
            : `sip:${transferNumber.replace('+', '')}@sip.twilio.com`;

          await withTimeout(
            sipClient.transferSipParticipant(roomName, sipParticipant.identity, transferTo),
            8000
          );

          console.log(`[transfer_to_human] SIP REFER sent to ${transferTo} for participant ${sipParticipant.identity}`);
          return {
            transfer_initiated: true,
            transfer_type: 'sip_refer',
            destination: transferTo,
            reason: args.reason,
            urgency: args.urgency ?? 'normal',
          };
        }

        // No SIP participant found (pure WebRTC call)
        console.warn('[transfer_to_human] No SIP participant found in room; cannot issue REFER');
        return {
          transfer_initiated: false,
          reason: args.reason,
          message: 'A team member will reach out to you within a few minutes.',
        };

      } catch (err) {
        console.error('[transfer_to_human] Transfer failed:', err);
        return {
          transfer_initiated: false,
          reason: args.reason,
          error: 'Transfer encountered an issue. A team member will contact you shortly.',
        };
      }
    },
  });
}

// ─── check_order_status ────────────────────────────────────────────────────────

const checkOrderStatus = llm.tool({
  description: 'Look up the status of a customer order or support ticket by its ID.',
  parameters: {
    type: 'object' as const,
    properties: {
      order_id: { type: 'string', description: 'Order or ticket ID provided by the customer' },
      customer_email: { type: 'string', description: 'Customer email to verify identity (optional)' },
    },
    required: ['order_id'],
  },
  execute: async (args: { order_id: string; customer_email?: string }, opts: ToolOpts) => {
    opts.ctx.session.say('Give me just a second while I pull that up.');
    try {
      return await withTimeout(Promise.resolve(getMockOrderStatus(args.order_id)), TOOL_TIMEOUT_MS);
    } catch {
      return { error: 'Unable to retrieve order status. Please check the website or contact support.' };
    }
  },
});

function getMockOrderStatus(orderId: string) {
  const statuses = ['processing', 'shipped', 'delivered', 'cancelled'] as const;
  const status = statuses[orderId.length % statuses.length]!;
  return {
    order_id: orderId,
    status,
    estimated_delivery: status === 'shipped' ? '2 business days' : null,
    tracking_number: status === 'shipped' ? `TRK-${orderId.toUpperCase()}` : null,
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
    ...(config.enableOrders
      ? { check_order_status: checkOrderStatus }
      : {}),
  };
}
