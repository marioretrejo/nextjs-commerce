/**
 * POST /api/webhooks/twilio/status
 *
 * Receives Twilio call status callbacks (completed, failed, no-answer, busy).
 * Used to update call records and surface failed inbound calls.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { validateTwilioRequest } from '@/lib/twilio/validate';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.text();

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? '';
  if (process.env['NODE_ENV'] === 'production') {
    const valid = validateTwilioRequest(req, body, appUrl, '/api/webhooks/twilio/status');
    if (!valid) return new NextResponse('Forbidden', { status: 403 });
  }

  const params = Object.fromEntries(new URLSearchParams(body));
  const callSid      = params['CallSid'] ?? '';
  const callStatus   = params['CallStatus'] ?? '';   // completed | failed | no-answer | busy | canceled
  const callDuration = Number(params['CallDuration'] ?? '0'); // seconds, Twilio-reported

  if (!callSid) return NextResponse.json({ ok: true });

  // Map Twilio status → our call status
  const ourStatus =
    callStatus === 'completed' ? 'completed' :
    callStatus === 'failed'    ? 'failed'    :
    callStatus === 'busy'      ? 'failed'    :
    callStatus === 'no-answer' ? 'no_answer' :
    callStatus === 'canceled'  ? 'cancelled' :
    'failed';

  const admin = createAdminClient();

  // Find the call by routing_data->call_sid
  const { data: calls } = await admin
    .from('calls')
    .select('id')
    .contains('routing_data', { call_sid: callSid })
    .limit(1);

  const callId = (calls as { id: string }[] | null)?.[0]?.id;
  if (callId) {
    await admin.from('calls').update({
      status:           ourStatus,
      duration_seconds: callDuration,
    }).eq('id', callId);
  }

  return NextResponse.json({ ok: true });
}
