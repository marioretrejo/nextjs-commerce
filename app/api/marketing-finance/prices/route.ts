import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

async function guardSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("users")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  return profile?.is_superadmin ? user : null;
}

export async function GET() {
  const user = await guardSuperadmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mf_cpa_prices")
    .select("id, campaign, country, price, notes, updated_at")
    .order("campaign")
    .order("country");

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const user = await guardSuperadmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    campaign: string;
    country: string;
    price: number;
    notes?: string;
  };
  if (!body.campaign?.trim())
    return NextResponse.json({ error: "campaign required" }, { status: 400 });
  if (body.price == null || isNaN(body.price))
    return NextResponse.json({ error: "price required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mf_cpa_prices")
    .insert({
      campaign: body.campaign.trim(),
      country: (body.country ?? "ALL").trim() || "ALL",
      price: body.price,
      notes: body.notes?.trim() || null,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json(
      { error: error.message },
      { status: error.code === "23505" ? 409 : 500 },
    );
  return NextResponse.json(data, { status: 201 });
}
