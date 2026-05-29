/**
 * GET|POST /api/v1/outbound/twiml
 *
 * TwiML callback invoked by Twilio when the recipient answers an outbound call.
 * Returns XML instructing Twilio to bridge the PSTN call into a LiveKit room
 * via SIP, where the AI worker is already running.
 *
 * Query params:
 *   room  — LiveKit room name (e.g. "agent-{uuid}-{ts}")
 *   host  — LiveKit SIP endpoint host (e.g. "sip.livekit.run")
 *
 * Security note: room names are UUIDs + timestamps — not guessable.
 * We also validate the Twilio signature in production.
 */
import { validateTwilioRequest } from '@/lib/twilio/validate';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function twiml(xml: string): NextResponse {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${xml}\n</Response>`,
    { headers: { 'Content-Type': 'text/xml' } },
  );
}

async function handle(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const roomName = url.searchParams.get('room') ?? '';
  const sipHost  = url.searchParams.get('host') ?? process.env['LIVEKIT_SIP_HOST'] ?? 'sip.livekit.run';

  // In production, validate Twilio signature
  if (process.env['NODE_ENV'] === 'production') {
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? '';
    const body   = req.method === 'POST' ? await req.text() : '';
    const valid  = validateTwilioRequest(req, body, appUrl, url.pathname + url.search);
    if (!valid) return new NextResponse('Forbidden', { status: 403 });
  }

  if (!roomName) {
    return twiml('  <Say voice="alice">An error occurred. Goodbye.</Say>\n  <Hangup/>');
  }

  // Bridge the PSTN call into the LiveKit room via SIP.
  // LiveKit accepts the call, the worker is already in the room.
  const sipUri = `sip:${encodeURIComponent(roomName)}@${sipHost}`;
  const statusCallbackUrl = `${process.env['NEXT_PUBLIC_APP_URL'] ?? ''}/api/webhooks/twilio/status`;

  return twiml(
    `  <Dial timeout="30" action="${statusCallbackUrl}" method="POST">\n` +
    `    <Sip statusCallbackEvent="initiated ringing answered completed"\n` +
    `         statusCallback="${statusCallbackUrl}">\n` +
    `      ${sipUri}\n` +
    `    </Sip>\n` +
    `  </Dial>`
  );
}

export const GET  = handle;
export const POST = handle;
