import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: ws } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .single();
    if (!ws)
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );

    const body = (await req.json()) as {
      phone_number?: string;
      country_code?: string;
      country_name?: string;
    };
    if (!body.phone_number)
      return NextResponse.json(
        { error: "phone_number is required" },
        { status: 400 },
      );

    const admin = createAdminClient();
    const { data: integration } = await admin
      .from("integrations")
      .select("credentials")
      .eq("workspace_id", ws.id)
      .eq("type", "twilio")
      .eq("status", "connected")
      .maybeSingle();

    if (!integration)
      return NextResponse.json(
        { error: "Twilio not connected" },
        { status: 400 },
      );

    const creds = integration.credentials as {
      account_sid: string;
      auth_token: string;
    };
    const auth = Buffer.from(
      `${creds.account_sid}:${creds.auth_token}`,
    ).toString("base64");

    const buyRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${creds.account_sid}/IncomingPhoneNumbers.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ PhoneNumber: body.phone_number }),
      },
    );

    if (!buyRes.ok) {
      const errData = (await buyRes.json().catch(() => ({}))) as {
        message?: string;
      };
      return NextResponse.json(
        { error: errData.message ?? "Failed to purchase number from Twilio" },
        { status: 502 },
      );
    }

    const bought = (await buyRes.json()) as {
      sid: string;
      phone_number: string;
      friendly_name: string;
    };

    const { data: inserted, error: insertErr } = await admin
      .from("phone_numbers")
      .insert({
        workspace_id: ws.id,
        number: bought.phone_number,
        provider: "twilio",
        country_code: body.country_code ?? "US",
        country_name: body.country_name ?? bought.friendly_name,
        status: "available",
        twilio_sid: bought.sid,
      })
      .select()
      .single();

    if (insertErr)
      return NextResponse.json({ error: insertErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, number: inserted });
  } catch (e) {
    console.error("[twilio-buy]", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
