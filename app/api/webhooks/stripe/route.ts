/**
 * POST /api/webhooks/stripe  (also aliased at /api/stripe/webhook)
 *
 * Validates Stripe signature then dispatches subscription lifecycle events
 * to keep workspaces and users in sync with Stripe's source of truth.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY        — Stripe secret key
 *   STRIPE_WEBHOOK_SECRET    — from Stripe dashboard → Webhooks → signing secret
 *   STRIPE_PRICE_PRO         — price ID for Pro plan
 *   STRIPE_PRICE_SCALE       — price ID for Scale plan
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { sendPaymentFailed, sendTopUpReceipt } from "@/lib/email";
import { sendWorkspaceAlert } from "@/lib/notifications/telegram";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

// Node.js runtime required — body must be read as raw text for Stripe signature
// verification; the Edge runtime's Web Streams API produces different byte
// sequences that cause constructEvent() to throw "No signatures found".
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN_MINUTES: Record<string, number> = {
  pro: 1000,
  scale: 5000,
  free: 50,
};

function planFromPriceId(priceId: string | undefined): string {
  if (priceId === process.env["STRIPE_PRICE_PRO"]) return "pro";
  if (priceId === process.env["STRIPE_PRICE_SCALE"]) return "scale";
  return "free";
}

/** Resolve workspace id from multiple sources and upsert plan/subscription data. */
async function syncSubscription(
  admin: ReturnType<typeof createAdminClient>,
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

export async function POST(req: Request) {
  // Read raw body text — must happen BEFORE any JSON parsing
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    console.error("[stripe/webhook] missing stripe-signature header");
    return new NextResponse("Missing signature", { status: 400 });
  }

  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set");
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/webhook] signature validation failed:", msg);
    return new NextResponse(`Invalid signature: ${msg}`, { status: 400 });
  }

  console.log("[stripe/webhook] received", { type: event.type, id: event.id });

  const admin = createAdminClient();

  // ── Idempotency: dedup on Stripe's event.id ──────────────────────────────
  // Stripe retries deliveries (and can deliver duplicates). Without this guard
  // a retried checkout.session.completed top-up would credit the balance twice.
  const { error: dedupErr } = await admin
    .from("processed_webhook_events")
    .insert({ provider: "stripe", event_id: event.id });
  if (dedupErr) {
    if ((dedupErr as { code?: string }).code === "23505") {
      console.log("[stripe/webhook] duplicate event ignored", event.id);
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[stripe/webhook] dedup ledger error", dedupErr.message);
    return new NextResponse("Idempotency ledger unavailable", { status: 503 });
  }

  try {
    switch (event.type) {
      // ── Subscription lifecycle ────────────────────────────────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await syncSubscription(admin, event.data.object as Stripe.Subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const { data: ws } = await admin
          .from("workspaces")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        const wsId = (ws as { id: string } | null)?.id;

        console.log("[stripe/webhook] subscription deleted", {
          subId: sub.id,
          wsId,
        });

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
          console.error(
            "[stripe/webhook] downgrade user error",
            userErr.message,
          );
        break;
      }

      // ── Checkout completed ────────────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Subscription checkout → sync plan immediately
        if (session.mode === "subscription" && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string,
          );
          await syncSubscription(admin, sub, session.metadata?.workspace_id);
          break;
        }

        // One-time credit top-up
        if (session.metadata?.type === "voiceos_topup") {
          const workspaceId = session.metadata.workspace_id;
          const amountCents = Number(session.metadata.amount_cents ?? 0);

          console.log("[stripe/webhook] topup completed", {
            workspaceId,
            amountCents,
          });

          if (!workspaceId || !amountCents) break;

          // Atomic balance credit. The previous read-modify-write fallback was
          // removed: two concurrent top-ups (or a retry racing the original)
          // would read the same balance and silently drop one credit. On failure
          // we throw so the outer catch returns a retryable 5xx.
          const { error: rpcErr } = await admin.rpc(
            "increment_workspace_balance",
            {
              p_workspace_id: workspaceId,
              p_amount_cents: amountCents,
            },
          );
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
        break;
      }

      // ── Invoices ──────────────────────────────────────────────────────────────
      // payment_succeeded and paid are equivalent for our purposes (invoice
      // settled): both record the invoice. Handle them with the same logic.
      case "invoice.payment_succeeded":
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
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

        console.log("[stripe/webhook] invoice paid", {
          invoiceId: inv.id,
          wsId,
        });

        if (wsId) {
          // Upsert prevents duplicates if Stripe retries the event
          const { error } = await admin.from("billing_invoices").upsert(
            {
              workspace_id: wsId,
              stripe_invoice_id: inv.id,
              amount: inv.amount_paid,
              currency: inv.currency,
              status: "paid",
              period_start: new Date(
                (inv.period_start ?? 0) * 1000,
              ).toISOString(),
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
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
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
        const appUrl =
          process.env["NEXT_PUBLIC_APP_URL"] ?? "https://voiceos.app";

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
        break;
      }

      default:
        console.log("[stripe/webhook] unhandled event type", event.type);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/webhook] handler error", {
      type: event.type,
      id: event.id,
      msg,
    });
    // Roll back the idempotency marker so Stripe's retry can reprocess this
    // event (otherwise the dedup guard would swallow the retry and the work —
    // e.g. a paid top-up credit — would be permanently lost).
    await admin
      .from("processed_webhook_events")
      .delete()
      .eq("provider", "stripe")
      .eq("event_id", event.id);
    // 500 → Stripe retries with backoff.
    return NextResponse.json({ received: false, error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
