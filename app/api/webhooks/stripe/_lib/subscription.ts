import type { createAdminClient } from "@/lib/supabase/admin";
import type Stripe from "stripe";

export type Admin = ReturnType<typeof createAdminClient>;

export const PLAN_MINUTES: Record<string, number> = {
  pro: 1000,
  scale: 5000,
  free: 50,
};

export function planFromPriceId(priceId: string | undefined): string {
  if (priceId === process.env["STRIPE_PRICE_PRO"]) return "pro";
  if (priceId === process.env["STRIPE_PRICE_SCALE"]) return "scale";
  return "free";
}

/** Resolve workspace id from multiple sources and upsert plan/subscription data. */
export async function syncSubscription(
  admin: Admin,
  sub: Stripe.Subscription,
  explicitWorkspaceId?: string | null,
) {
  const priceId = sub.items.data[0]?.price.id;
  const plan = planFromPriceId(priceId);
  const customerId = sub.customer as string;

  // Resolve workspace: explicit → subscription metadata → customer lookup → owner lookup
  let wsId = explicitWorkspaceId ?? sub.metadata?.workspace_id ?? null;

  if (!wsId) {
    const { data: ws } = await admin
      .from("workspaces")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    wsId = (ws as { id: string } | null)?.id ?? null;
  }

  if (!wsId) {
    const { data: ownerUser } = await admin
      .from("users")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (ownerUser) {
      const { data: ws } = await admin
        .from("workspaces")
        .select("id")
        .eq("owner_id", (ownerUser as { id: string }).id)
        .single();
      wsId = (ws as { id: string } | null)?.id ?? null;
    }
  }

  console.log("[stripe/webhook] syncSubscription", {
    subId: sub.id,
    plan,
    customerId,
    wsId,
    status: sub.status,
  });

  if (wsId) {
    const { error } = await admin
      .from("workspaces")
      .update({
        plan,
        minutes_limit: PLAN_MINUTES[plan] ?? 50,
        is_white_label: plan === "scale",
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        stripe_price_id: priceId ?? null,
        subscription_status: sub.status,
        billing_status:
          sub.status === "active" || sub.status === "trialing"
            ? "active"
            : "suspended_for_nonpayment",
      })
      .eq("id", wsId);
    if (error)
      console.error("[stripe/webhook] workspaces update error", error.message);

    // Re-activate paused campaigns when plan upgrades
    if (plan !== "free") {
      await admin
        .from("campaigns")
        .update({ status: "active", pause_reason: null })
        .eq("workspace_id", wsId)
        .eq("pause_reason", "minute_limit_reached");
    }
  }

  const { error: userErr } = await admin
    .from("users")
    .update({
      plan,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
    })
    .eq("stripe_customer_id", customerId);
  if (userErr)
    console.error("[stripe/webhook] users update error", userErr.message);
}
