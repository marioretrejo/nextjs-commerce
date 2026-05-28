/**
 * VoiceOS Tool Registry
 *
 * Tools give the LLM the ability to take real actions during a call (look up
 * data, book appointments, transfer to human, etc.). Each tool's `execute`
 * function runs async; the agent speaks a contingency phrase while it waits.
 *
 * To add a new tool: define it here and include it in `buildTools()`.
 * Parameters use raw JSON Schema — no Zod required.
 */
import { llm } from '@livekit/agents';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolOpts = Parameters<llm.FunctionTool<any>['execute']>[1];

/** Milliseconds the agent waits for a tool response before giving up. */
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
      return { error: 'Unable to retrieve availability right now. I\'ll have someone follow up.' };
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
    'Book an appointment for the user after they confirm a specific date and time. Always confirm the slot with the user before calling this.',
  parameters: {
    type: 'object' as const,
    properties: {
      date: { type: 'string', description: 'Appointment date in YYYY-MM-DD format' },
      time: { type: 'string', description: 'Appointment time, e.g. "2:00 PM"' },
      name: { type: 'string', description: 'Full name of the person booking' },
      email: { type: 'string', description: 'Contact email for the booking confirmation' },
      service_type: { type: 'string', description: 'Type of appointment or service' },
      notes: { type: 'string', description: 'Any additional notes or preferences' },
    },
    required: ['date', 'time', 'name', 'service_type'],
  },
  execute: async (
    args: { date: string; time: string; name: string; email?: string; service_type: string; notes?: string },
    opts: ToolOpts
  ) => {
    opts.ctx.session.say('Perfect, I\'m booking that for you right now.');
    try {
      return await withTimeout(
        Promise.resolve(createMockBooking(args)),
        TOOL_TIMEOUT_MS
      );
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

const transferToHuman = llm.tool({
  description:
    'Transfer the user to a live human agent. Use when: user explicitly asks for a human, the issue is too complex, or you cannot resolve it after 2 attempts.',
  parameters: {
    type: 'object' as const,
    properties: {
      reason: { type: 'string', description: 'Brief reason for the transfer' },
      urgency: {
        type: 'string',
        enum: ['low', 'normal', 'high'],
        description: 'Urgency level',
      },
    },
    required: ['reason'],
  },
  execute: async (args: { reason: string; urgency?: string }, opts: ToolOpts) => {
    opts.ctx.session.say(
      'Of course, let me connect you with one of our team members right away. Please hold on for just a moment.'
    );
    // TODO: trigger actual SIP REFER or CRM webhook here
    console.log(`[transfer_to_human] reason="${args.reason}" urgency="${args.urgency ?? 'normal'}"`);
    return {
      transfer_initiated: true,
      reason: args.reason,
      urgency: args.urgency ?? 'normal',
      estimated_wait: '< 2 minutes',
    };
  },
});

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
    opts.ctx.session.say('Give me just a second while I pull up that order.');
    try {
      return await withTimeout(
        Promise.resolve(getMockOrderStatus(args.order_id)),
        TOOL_TIMEOUT_MS
      );
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

export function buildTools(opts?: {
  enableTransfer?: boolean;
  enableOrders?: boolean;
}): llm.ToolContext {
  return {
    check_availability: checkAvailability,
    book_appointment: bookAppointment,
    ...(opts?.enableTransfer !== false ? { transfer_to_human: transferToHuman } : {}),
    ...(opts?.enableOrders ? { check_order_status: checkOrderStatus } : {}),
  };
}
