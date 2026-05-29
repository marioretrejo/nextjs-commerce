#!/usr/bin/env tsx
/**
 * scripts/simulate-twilio.ts
 *
 * Local Twilio simulation tool for development and testing.
 * Run with:  npx tsx scripts/simulate-twilio.ts <command> [options]
 *
 * Commands:
 *   inbound  --to +1555... [--from +1555...] [--base http://localhost:3000]
 *     Simulates an inbound call arriving at /api/webhooks/twilio/incoming.
 *     Skips HMAC validation (NODE_ENV=development).
 *
 *   room-finished  --room agent-<uuid>-<ts> [--duration 90] [--base http://localhost:3000]
 *     Simulates a LiveKit room_finished webhook, which triggers billing,
 *     post-call analysis, and fires customer webhooks (deliver.ts).
 *
 *   status  --room agent-<uuid>-<ts> --sid <twilio_call_sid> [--status completed]
 *     Simulates a Twilio call status callback.
 *
 * Examples:
 *   npx tsx scripts/simulate-twilio.ts inbound --to +15551234567 --from +12025550001
 *   npx tsx scripts/simulate-twilio.ts room-finished --room agent-abc123-1717000000000 --duration 120
 *   npx tsx scripts/simulate-twilio.ts status --room agent-abc123-1717000000000 --sid CA000 --status completed
 */

import crypto from 'crypto';

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const command = args[0] ?? '';

function flag(name: string, fallback = ''): string {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? (args[idx + 1] as string) : fallback;
}

const BASE = flag('base', 'http://localhost:3000');

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function post(path: string, body: Record<string, unknown>, contentType = 'application/json') {
  const url = `${BASE}${path}`;
  let bodyStr: string;
  let headers: Record<string, string> = {};

  if (contentType === 'application/x-www-form-urlencoded') {
    bodyStr = new URLSearchParams(body as Record<string, string>).toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  } else {
    bodyStr = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  console.log(`\n→ POST ${url}`);
  console.log('  Body:', contentType === 'application/json' ? JSON.stringify(body, null, 2) : bodyStr);

  const res = await fetch(url, { method: 'POST', headers, body: bodyStr });
  const text = await res.text();

  console.log(`\n← ${res.status} ${res.statusText}`);
  try {
    const parsed = JSON.parse(text);
    console.log('  Response:', JSON.stringify(parsed, null, 2));
  } catch {
    console.log('  Response:', text.slice(0, 500));
  }

  return { status: res.status, body: text };
}

// Build a fake LiveKit webhook body (JSON with Authorization header)
// We don't validate signatures in dev so we send an empty auth header.
async function postLiveKit(path: string, payload: Record<string, unknown>) {
  const url = `${BASE}${path}`;
  const bodyStr = JSON.stringify(payload);

  console.log(`\n→ POST ${url}`);
  console.log('  Payload:', JSON.stringify(payload, null, 2));

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Empty Authorization — dev mode skips verification
      Authorization: 'sim_no_sig',
    },
    body: bodyStr,
  });

  const text = await res.text();
  console.log(`\n← ${res.status} ${res.statusText}`);
  try { console.log('  Response:', JSON.stringify(JSON.parse(text), null, 2)); }
  catch { console.log('  Response:', text.slice(0, 500)); }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function simulateInbound() {
  const to   = flag('to',   '+15550000001');
  const from = flag('from', '+12025550000');

  console.log('\n🔵  Simulating INBOUND call from Twilio');
  console.log(`    To: ${to}  ·  From: ${from}`);

  // Twilio sends URLEncoded form data
  await post('/api/webhooks/twilio/incoming', {
    To:             to,
    From:           from,
    CallSid:        `SIM${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
    CallStatus:     'ringing',
    Direction:      'inbound',
    ApiVersion:     '2010-04-01',
    AccountSid:     'ACsimulated00000000000000000000000',
  }, 'application/x-www-form-urlencoded');

  console.log('\n✅  Inbound simulation complete.');
  console.log('    Check: did the endpoint return TwiML <Dial><Sip>…? (look for text/xml response)');
}

async function simulateRoomFinished() {
  const roomName = flag('room', `agent-00000000-0000-0000-0000-000000000000-${Date.now()}`);
  const durationSec = Number(flag('duration', '90'));
  const creationTime = Math.floor((Date.now() - durationSec * 1000) / 1000);

  console.log('\n🟡  Simulating LiveKit room_finished webhook');
  console.log(`    Room: ${roomName}  ·  Duration: ${durationSec}s`);

  // LiveKit webhook payload shape (simplified)
  const payload = {
    event: 'room_finished',
    id:    `EV${crypto.randomBytes(8).toString('hex')}`,
    createdAt: Math.floor(Date.now() / 1000),
    room: {
      name:         roomName,
      sid:          `RM${crypto.randomBytes(8).toString('hex')}`,
      creationTime: creationTime,
      numParticipants: 0,
      numPublishers:   0,
      metadata: JSON.stringify({
        agent_name: 'Simulated Agent',
        workspace_id: '00000000-0000-0000-0000-000000000000',
      }),
    },
  };

  await postLiveKit('/api/webhooks/livekit', payload);

  console.log('\n✅  room_finished simulation complete.');
  console.log('    Check: Was the call billed? Was deliver.ts called? Did your webhook endpoint receive a POST?');
}

async function simulateStatus() {
  const roomName = flag('room', '');
  const callSid  = flag('sid', `CA${crypto.randomBytes(10).toString('hex').toUpperCase()}`);
  const status   = flag('status', 'completed');
  const duration = flag('duration', '90');

  if (!roomName) {
    console.error('❌  --room is required for "status" command');
    process.exit(1);
  }

  console.log('\n🟣  Simulating Twilio call status callback');
  console.log(`    Room: ${roomName}  ·  CallSid: ${callSid}  ·  Status: ${status}`);

  await post('/api/webhooks/twilio/status', {
    CallSid:        callSid,
    CallStatus:     status,
    CallDuration:   duration,
    To:             '+15550000001',
    From:           '+12025550000',
    AccountSid:     'ACsimulated00000000000000000000000',
  }, 'application/x-www-form-urlencoded');

  console.log('\n✅  Status callback simulation complete.');
}

// ─── Entry point ──────────────────────────────────────────────────────────────
const USAGE = `
Usage:
  npx tsx scripts/simulate-twilio.ts <command> [options]

Commands:
  inbound         Simulate an incoming call
    --to          Called number (E.164)         default: +15550000001
    --from        Caller's number (E.164)       default: +12025550000
    --base        App base URL                  default: http://localhost:3000

  room-finished   Simulate a LiveKit room_finished event
    --room        Room name (required)
    --duration    Call duration in seconds      default: 90
    --base        App base URL

  status          Simulate a Twilio call status callback
    --room        Room name (required)
    --sid         Twilio CallSid                default: random
    --status      completed|failed|busy|no-answer  default: completed
    --duration    Duration in seconds           default: 90
    --base        App base URL

Examples:
  npx tsx scripts/simulate-twilio.ts inbound --to +15551234567
  npx tsx scripts/simulate-twilio.ts room-finished --room agent-abc-1717000000 --duration 120
  npx tsx scripts/simulate-twilio.ts status --room agent-abc-1717000000 --status completed
`;

(async () => {
  switch (command) {
    case 'inbound':       await simulateInbound();       break;
    case 'room-finished': await simulateRoomFinished();  break;
    case 'status':        await simulateStatus();        break;
    default:
      console.log(USAGE);
      if (command && command !== '--help' && command !== '-h') {
        console.error(`\n❌  Unknown command: "${command}"`);
        process.exit(1);
      }
  }
})();
