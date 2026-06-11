/**
 * Replay the Twilio StatusCallback for Canary Call #2
 * to diagnose why the DB wasn't updated after the real callback.
 */
import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const VERCEL_URL = "https://nextjs-commerce-git-claude-voic-6cb608-marios-projects-0d440ccd.vercel.app";
const WEBHOOK_PATH = "/api/webhooks/twilio/status";
const AUTH_TOKEN = process.env["TWILIO_AUTH_TOKEN"]!;
const TWILIO_PHONE = process.env["TWILIO_PHONE_NUMBER"]!;

// Real call params from Canary Call #2 (Twilio reported: completed, 13s)
const params: Record<string, string> = {
  CallSid:        "CA6c5c165bc817e500ac34d1e8b0fa9105",
  CallStatus:     "completed",
  CallDuration:   "13",
  From:           TWILIO_PHONE,
  To:             "+18099052406",
  Direction:      "outbound-api",
};

function computeSig(authToken: string, url: string, params: Record<string, string>): string {
  const crypto = require("crypto");
  let data = url;
  Object.keys(params).sort().forEach(key => { data += key + params[key]; });
  return crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

async function main() {
  const fullUrl = `${VERCEL_URL}${WEBHOOK_PATH}`;
  const body = new URLSearchParams(params).toString();
  const signature = computeSig(AUTH_TOKEN, fullUrl, params);

  const { validateRequest } = await import("twilio/lib/webhooks/webhooks");
  const selfCheck = validateRequest(AUTH_TOKEN, signature, fullUrl, params);
  console.log(`Self-check: ${selfCheck ? "✅" : "❌"}`);
  if (!selfCheck) { console.error("Signature self-check failed"); process.exit(1); }

  console.log(`Sending completed StatusCallback for ${params["CallSid"]}...`);
  const res = await fetch(fullUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": signature,
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  console.log(`HTTP ${res.status} — ${text.slice(0, 200)}`);

  if (res.status === 200) {
    console.log("✅ Webhook accepted — checking DB...");
    // Wait 1s then check
    await new Promise(r => setTimeout(r, 1500));
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
      { auth: { persistSession: false } },
    );
    const { data: call } = await admin
      .from("calls").select("id,status,technical_status,duration_seconds,ended_at")
      .eq("id", "a8bd4df2-5116-4e68-8eb8-9be93880c977").single();
    console.log("DB call record:", JSON.stringify(call, null, 2));
  } else if (res.status === 403) {
    console.error("❌ 403 — signature rejected — URL mismatch");
  }
}
main().catch(e => { console.error("FATAL:", e); process.exit(1); });
