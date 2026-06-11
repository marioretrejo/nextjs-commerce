/**
 * Replay the Twilio StatusCallback for Canary Call #3
 * to diagnose why the DB wasn't updated.
 */
import * as dotenv from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const VERCEL_URL =
  "https://nextjs-commerce-git-claude-voic-6cb608-marios-projects-0d440ccd.vercel.app";
const WEBHOOK_PATH = "/api/webhooks/twilio/status";
const AUTH_TOKEN = process.env["TWILIO_AUTH_TOKEN"]!;
const TWILIO_PHONE = process.env["TWILIO_PHONE_NUMBER"]!;

const params: Record<string, string> = {
  CallSid: "CAbb1d1bdedca85e422ba4d12f04968e03",
  CallStatus: "completed",
  CallDuration: "6",
  From: TWILIO_PHONE,
  To: "+18099052406",
  Direction: "outbound-api",
};

function computeSig(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
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

async function main() {
  const fullUrl = `${VERCEL_URL}${WEBHOOK_PATH}`;
  const body = new URLSearchParams(params).toString();
  const signature = computeSig(AUTH_TOKEN, fullUrl, params);

  const { validateRequest } = await import("twilio/lib/webhooks/webhooks");
  const selfCheck = validateRequest(AUTH_TOKEN, signature, fullUrl, params);
  console.log(`Self-check: ${selfCheck ? "✅" : "❌"}`);
  if (!selfCheck) {
    console.error("Signature self-check failed");
    process.exit(1);
  }

  console.log(`Sending completed StatusCallback for ${params["CallSid"]}...`);
  const res = await fetch(fullUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": signature,
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  console.log(`HTTP ${res.status} — ${text.slice(0, 300)}`);

  await new Promise((r) => setTimeout(r, 1500));

  const admin = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );
  const { data: call } = await admin
    .from("calls")
    .select("id,status,technical_status,duration_seconds,ended_at,end_reason")
    .eq("id", "7e929400-964c-40c2-9908-ec9e413ddd64")
    .single();
  console.log("DB call record:", JSON.stringify(call, null, 2));

  const { data: ws } = await admin
    .from("workspaces")
    .select("active_calls")
    .eq("id", "cd7b409f-82a3-4da2-8f7c-d49c11d62105")
    .single();
  console.log("active_calls:", ws?.active_calls);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
