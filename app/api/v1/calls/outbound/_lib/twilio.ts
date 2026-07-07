import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

// Resolve caller ID: explicit param → workspace default number → env fallback.
export async function resolveCallerId(
  admin: Admin,
  workspaceId: string,
  fromNumber?: string,
): Promise<string> {
  if (fromNumber) return fromNumber;
  const { data: defaultNumber } = await admin
    .from("phone_numbers")
    .select("number")
    .eq("workspace_id", workspaceId)
    .eq("status", "available")
    .limit(1)
    .single();
  return (
    (defaultNumber as { number: string } | null)?.number ??
    process.env["TWILIO_PHONE_NUMBER"] ??
    ""
  );
}

// Initiate an outbound call via the Twilio REST API. Returns the Twilio call SID
// or throws on any non-2xx / network error.
export async function initiateTwilioCall(opts: {
  twilioSid: string;
  twilioToken: string;
  to: string;
  callerId: string;
  twimlCallbackUrl: string;
  statusCallbackUrl: string;
}): Promise<string> {
  const callParams = new URLSearchParams({
    To: opts.to,
    From: opts.callerId,
    Url: opts.twimlCallbackUrl,
    StatusCallback: opts.statusCallbackUrl,
    StatusCallbackMethod: "POST",
    StatusCallbackEvent: "initiated ringing answered completed",
    MachineDetection: "Enable", // AMD — skip voicemail
    AsyncAmdStatusCallback: opts.statusCallbackUrl,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${opts.twilioSid}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${opts.twilioSid}:${opts.twilioToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: callParams.toString(),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio ${res.status}: ${text}`);
  }

  const twilioResponse = (await res.json()) as { sid: string; status: string };
  return twilioResponse.sid;
}
