import { createClient } from "@/lib/supabase/server";
import { getUserWorkspaces } from "@/lib/workspace";
import { stripe } from "@/lib/stripe/client";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [workspaces, { data: userProfile }] = await Promise.all([
    getUserWorkspaces(),
    supabase
      .from("users")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single(),
  ]);

  const workspace = workspaces[0];

  // Prefer workspace-level customer ID, fall back to user-level
  const customerId =
    (workspace as { stripe_customer_id?: string | null } | undefined)
      ?.stripe_customer_id ??
    (userProfile as { stripe_customer_id: string | null } | null)
      ?.stripe_customer_id;

  if (!customerId) {
    return NextResponse.json(
      { error: "No billing account found. Subscribe to a plan first." },
      { status: 400 },
    );
  }

  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/billing`,
  });

  return NextResponse.json({ url: session.url });
}
