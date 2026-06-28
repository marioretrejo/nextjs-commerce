import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const clientId = process.env["HUBSPOT_CLIENT_ID"];
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"];

  if (!clientId) {
    return NextResponse.json(
      { error: "HubSpot integration not configured" },
      { status: 503 },
    );
  }

  // CSRF protection: generate a random state, store it in an HttpOnly cookie,
  // and verify it on callback so an attacker can't bind their HubSpot account
  // into a victim's workspace via a forged callback.
  const state = crypto.randomBytes(32).toString("hex");

  const redirectUri = `${appUrl}/api/integrations/hubspot/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "crm.objects.contacts.write crm.objects.contacts.read timeline",
    response_type: "code",
    state,
  });

  const res = NextResponse.redirect(
    `https://app.hubspot.com/oauth/authorize?${params.toString()}`,
  );
  res.cookies.set("hubspot_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
