import { stripe } from "@/lib/stripe/client";
import { sendPaymentFailed, sendTopUpReceipt } from "@/lib/email";
import { sendWorkspaceAlert } from "@/lib/notifications/telegram";
import type Stripe from "stripe";
import { PLAN_MINUTES, syncSubscription, type Admin } from "./subscription";

export async function handleSubscriptionDeleted(
  admin: Admin,
  sub: Stripe.Subscription,
) {
  const customerId = sub.customer as string;

  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  const wsId = (ws as { id: string } | null)?.id;

  console.log("[stripe/webhook] subscription deleted", { subId: sub.id, wsId });

  if (wsId) {
    const { error } = await admin
      .from("workspaces")
      .update({
        plan: "free",
        minutes_limit: PLAN_MINUTES["free"],
        stripe_subscription_id: null,
        stripe_price_id: null,
        subscription_status: "canceled",
        billing_status: "active", // free plan stays accessible
      })
      .eq("id", wsId);
    if (error)
      console.error(
        "[stripe/webhook] downgrade workspace error",
        error.message,
      );
  }

  const { error: userErr } = await admin
    .from("users")
    .update({
      plan: "free",
      stripe_subscription_id: null,
      subscription_status: "canceled",
    })
    .eq("stripe_customer_id", customerId);
  if (userErr)
    console.error("[stripe/webhook] downgrade user error", userErr.message);
}

export async function handleCheckoutCompleted(
  admin: Admin,
  session: Stripe.Checkout.Session,
) {
  // Subscription checkout → sync plan immediately
  if (session.mode === "subscription" && session.subscription) {
    const sub = await stripe.subscriptions.retrieve(
      session.subscription as string,
    );
    await syncSubscription(admin, sub, session.metadata?.workspace_id);
    return;
  }

  // One-time credit top-up
  if (session.metadata?.type === "voiceos_topup") {
    const workspaceId = session.metadata.workspace_id;
    const amountCents = Number(session.metadata.amount_cents ?? 0);

    console.log("[stripe/webhook] topup completed", {
      workspaceId,
      amountCents,
    });

    if (!workspaceId || !amountCents) return;

    // Atomic balance credit. The previous read-modify-write fallback was
    // removed: two concurrent top-ups (or a retry racing the original)
    // would read the same balance and silently drop one credit. On failure
    // we throw so the outer catch returns a retryable 5xx.
    const { error: rpcErr } = await admin.rpc("increment_workspace_balance", {
      p_workspace_id: workspaceId,
      p_amount_cents: amountCents,
    });
    if (rpcErr) {
      throw new Error(`balance increment failed: ${rpcErr.message}`);
    }

    // Fire-and-forget: record invoice + send receipt email
    void Promise.resolve(
      admin.from("billing_invoices").upsert(
        {
          workspace_id: workspaceId,
          stripe_invoice_id: session.id,
          amount: amountCents,
          currency: session.currency ?? "usd",
          status: "paid",
          period_start: new Date().toISOString(),
          period_end: new Date().toISOString(),
          pdf_url: null,
        },
        { onConflict: "stripe_invoice_id", ignoreDuplicates: true },
      ),
    ).catch(console.error);

    void (async () => {
      const { data: ws } = await admin
        .from("workspaces")
        .select("owner_id, name")
        .eq("id", workspaceId)
        .single();
      if (!ws) return;
      const { data: owner } = await admin
        .from("users")
        .select("email")
        .eq("id", (ws as { owner_id: string }).owner_id)
        .single();
      if (owner?.email) {
        sendTopUpReceipt({
          to: owner.email,
          workspaceName: (ws as { name: string }).name,
          amount: `$${(amountCents / 100).toFixed(2)}`,
        }).catch(console.error);
      }
    })().catch(console.error);
  }
}

export async function handleInvoicePaid(admin: Admin, inv: Stripe.Invoice) {
  const customerId = inv.customer as string;

  let wsId: string | null = null;
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  wsId = (ws as { id: string } | null)?.id ?? null;

  if (!wsId) {
    const { data: ownerUser } = await admin
      .from("users")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (ownerUser) {
      const { data: ownerWs } = await admin
        .from("workspaces")
        .select("id")
        .eq("owner_id", (ownerUser as { id: string }).id)
        .single();
      wsId = (ownerWs as { id: string } | null)?.id ?? null;
    }
  }

  console.log("[stripe/webhook] invoice paid", { invoiceId: inv.id, wsId });

  if (wsId) {
    // Upsert prevents duplicates if Stripe retries the event
    const { error } = await admin.from("billing_invoices").upsert(
      {
        workspace_id: wsId,
        stripe_invoice_id: inv.id,
        amount: inv.amount_paid,
        currency: inv.currency,
        status: "paid",
        period_start: new Date((inv.period_start ?? 0) * 1000).toISOString(),
        period_end: new Date((inv.period_end ?? 0) * 1000).toISOString(),
        pdf_url: inv.invoice_pdf ?? null,
      },
      { onConflict: "stripe_invoice_id", ignoreDuplicates: true },
    );
    if (error)
      console.error(
        "[stripe/webhook] billing_invoices upsert error",
        error.message,
      );
  }
}

export async function handleInvoicePaymentFailed(
  admin: Admin,
  inv: Stripe.Invoice,
) {
  const customerId = inv.customer as string;

  const { data: userRow } = await admin
    .from("users")
    .select("id, email")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  const u = userRow as { id: string; email: string } | null;

  // Resolve workspace from the customer directly first (works even if the
  // user row is missing), then fall back to the owner lookup.
  const { data: wsByCustomer } = await admin
    .from("workspaces")
    .select("id, name")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  let wsRow = wsByCustomer as { id: string; name: string } | null;
  if (!wsRow && u) {
    const { data: wsByOwner } = await admin
      .from("workspaces")
      .select("id, name")
      .eq("owner_id", u.id)
      .maybeSingle();
    wsRow = wsByOwner as { id: string; name: string } | null;
  }
  const workspaceName = wsRow?.name ?? "your workspace";
  const wsId = wsRow?.id;
  const amountStr = `$${((inv.amount_due ?? 0) / 100).toFixed(2)}`;
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://voiceos.app";

  console.log("[stripe/webhook] invoice payment failed", {
    invoiceId: inv.id,
    wsId,
  });

  // Suspend workspace until payment is resolved + Telegram alert.
  if (wsId) {
    await admin
      .from("workspaces")
      .update({ billing_status: "suspended_for_nonpayment" })
      .eq("id", wsId);
    sendWorkspaceAlert(wsId, "💳 Payment failed — workspace suspended", [
      `🏢 Workspace: ${workspaceName}`,
      `💸 Amount due: ${amountStr}`,
      "🔴 Severity: HIGH",
      "➡️ Action: update the payment method to restore access.",
    ]).catch(console.error);
  }

  if (u) {
    await admin.from("notifications").insert({
      user_id: u.id,
      type: "payment_failed",
      title: "Payment failed",
      message: `Your payment of ${amountStr} failed. Please update your payment method.`,
    });
    sendPaymentFailed({
      to: u.email,
      workspaceName,
      amount: amountStr,
      retryUrl: `${appUrl}/billing`,
    }).catch(console.error);
  }
}
