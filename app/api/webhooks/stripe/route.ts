/**
 * POST /api/webhooks/stripe  (also aliased at /api/stripe/webhook)
 *
 * Validates Stripe signature then dispatches subscription lifecycle events
 * to keep workspaces and users in sync with Stripe's source of truth.
 * Per-event logic lives in _lib/handlers; subscription sync in _lib/subscription.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY        — Stripe secret key
 *   STRIPE_WEBHOOK_SECRET    — from Stripe dashboard → Webhooks → signing secret
 *   STRIPE_PRICE_PRO         — price ID for Pro plan
 *   STRIPE_PRICE_SCALE       — price ID for Scale plan
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { syncSubscription } from "./_lib/subscription";
import {
  handleSubscriptionDeleted,
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
} from "./_lib/handlers";

// Node.js runtime required — body must be read as raw text for Stripe signature
// verification; the Edge runtime's Web Streams API produces different byte
// sequences that cause constructEvent() to throw "No signatures found".
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      // ── Subscription lifecycle ──────────────────────────────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await syncSubscription(admin, event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          admin,
          event.data.object as Stripe.Subscription,
        );
        break;

      // ── Checkout completed ──────────────────────────────────────────────────
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          admin,
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      // ── Invoices ────────────────────────────────────────────────────────────
      // payment_succeeded and paid are equivalent for our purposes (invoice
      // settled): both record the invoice. Handle them with the same logic.
      case "invoice.payment_succeeded":
      case "invoice.paid":
        await handleInvoicePaid(admin, event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(
          admin,
          event.data.object as Stripe.Invoice,
        );
        break;

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
