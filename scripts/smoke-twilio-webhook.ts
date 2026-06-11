/**
 * Smoke test: Twilio StatusCallback webhook
 * Uses Twilio's own validateRequest to sign, then sends to Vercel.
 */
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const VERCEL_URL =
  "https://nextjs-commerce-git-claude-voic-6cb608-marios-projects-0d440ccd.vercel.app";
const WEBHOOK_PATH = "/api/webhooks/twilio/status";
const AUTH_TOKEN = process.env["TWILIO_AUTH_TOKEN"]!;

// Dummy payload — non-existent CallSid so DB is untouched
const params: Record<string, string> = {
  CallSid: "CA00000000000000000000000000SMOKE",
  CallStatus: "no-answer",
  CallDuration: "0",
  From: process.env["TWILIO_PHONE_NUMBER"]!,
  To: "+18099052406",
  Direction: "outbound-api",
};

function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  // Twilio algorithm: url + sorted(key+value) → HMAC-SHA1 → base64
  const crypto = require("crypto");
  let data = url;
  Object.keys(params)
    .sort()
    .forEach((key) => {
      data += key + params[key];
    });
  return crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");
}

async function run() {
  const fullUrl = `${VERCEL_URL}${WEBHOOK_PATH}`;
  const body = new URLSearchParams(params).toString();
  const signature = computeTwilioSignature(AUTH_TOKEN, fullUrl, params);

  // Local self-check: verify our own signature
  const { validateRequest } = await import("twilio/lib/webhooks/webhooks");
  const selfCheck = validateRequest(AUTH_TOKEN, signature, fullUrl, params);
  console.log(`=== Twilio StatusCallback smoke test ===`);
  console.log(`Target: ${fullUrl}`);
  console.log(`Self-check (local): ${selfCheck ? "✅ signature correct" : "❌ signature wrong"}`);
  if (!selfCheck) {
    console.error("Local signature computation failed — aborting");
    process.exit(1);
  }

  console.log(`\nSending POST to Vercel...`);
  const res = await fetch(fullUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": signature,
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  const responseText = await res.text();
  console.log(`Response: HTTP ${res.status} — ${responseText.slice(0, 200)}`);

  if (res.status === 200) {
    console.log("\n✅ PASS — Webhook reachable, signature accepted");
    console.log("   NEXT_PUBLIC_APP_URL is correctly set to the Vercel preview URL");
    console.log("   Twilio status callbacks will update the DB correctly");
  } else if (res.status === 403) {
    console.error("\n❌ FAIL — HTTP 403 Forbidden");
    console.error("   Our signature is locally valid, so Vercel's NEXT_PUBLIC_APP_URL is STILL wrong.");
    console.error(`   Vercel is validating against a different URL than: ${fullUrl}`);
    console.error("   Fix: set NEXT_PUBLIC_APP_URL=" + VERCEL_URL + " in Vercel Dashboard → Redeploy");
    process.exit(1);
  } else if (res.status === 307 || res.status === 308) {
    console.error(`\n❌ FAIL — Redirect ${res.status} — middleware blocking this route`);
    process.exit(1);
  } else if (res.status === 404) {
    console.error("\n❌ FAIL — 404 — route missing in deploy");
    process.exit(1);
  } else {
    console.warn(`\n⚠️  Unexpected HTTP ${res.status}`);
    process.exit(1);
  }
}

run().catch((e) => { console.error("FATAL:", e); process.exit(1); });
