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
  const answeredBy   = params['AnsweredBy'] ?? '';   // human | machine_start | machine_end_beep | fax | unknown

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

  // Find the call by routing_data->twilio_call_sid
  const { data: calls } = await admin
    .from('calls')
    .select('id, routing_data')
    .contains('routing_data', { twilio_call_sid: callSid })
    .limit(1);

  const callRow = (calls as { id: string; routing_data: Record<string, unknown> }[] | null)?.[0];
  if (!callRow) return NextResponse.json({ ok: true });

  // AMD: if answeredBy indicates a machine and amd_action is 'hangup', cancel the call
  const isMachine = answeredBy.startsWith('machine_') || answeredBy === 'fax';
  if (isMachine && callRow.routing_data?.amd_action === 'hangup') {
    const twilioSid   = process.env['TWILIO_ACCOUNT_SID'];
    const twilioToken = process.env['TWILIO_AUTH_TOKEN'];
    if (twilioSid && twilioToken) {
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls/${callSid}.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ Status: 'completed' }).toString(),
      }).catch(() => null);
    }
    await admin.from('calls').update({
      status: 'cancelled',
      duration_seconds: 0,
    }).eq('id', callRow.id);
    return NextResponse.json({ ok: true });
  }

  await admin.from('calls').update({
    status:           ourStatus,
    duration_seconds: callDuration,
  }).eq('id', callRow.id);

  return NextResponse.json({ ok: true });
}
