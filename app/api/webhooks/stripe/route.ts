/**
 * POST /api/webhooks/stripe
 *
 * Validates Stripe signature, then dispatches subscription lifecycle events
 * to keep workspaces and users in sync with Stripe's source of truth.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY        — Stripe secret key
 *   STRIPE_WEBHOOK_SECRET    — from Stripe dashboard → Webhooks → signing secret
 *   STRIPE_PRICE_PRO         — price ID for Pro plan
 *   STRIPE_PRICE_SCALE       — price ID for Scale plan
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe/client';
import { sendPaymentFailed, sendTopUpReceipt } from '@/lib/email';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

// TODO: ensure STRIPE_WEBHOOK_SECRET is set in Vercel env vars
// TODO: ensure STRIPE_PRICE_PRO and STRIPE_PRICE_SCALE are set in Vercel env vars

const PLAN_MINUTES: Record<string, number> = { pro: 1000, scale: 5000, free: 50 };

function planFromPriceId(priceId: string | undefined): string {
  if (priceId === process.env['STRIPE_PRICE_PRO'])   return 'pro';
  if (priceId === process.env['STRIPE_PRICE_SCALE']) return 'scale';
  return 'free';
}

async function syncSubscription(
  admin: ReturnType<typeof createAdminClient>,
  sub: Stripe.Subscription,
  explicitWorkspaceId?: string | null,
) {
  const priceId    = sub.items.data[0]?.price.id;
  const plan       = planFromPriceId(priceId);
  const customerId = sub.customer as string;

  // Resolve workspace: explicit > subscription metadata > customer lookup > owner lookup
  let wsId = explicitWorkspaceId ?? sub.metadata?.workspace_id ?? null;

  if (!wsId) {
    const { data: ws } = await admin
      .from('workspaces').select('id').eq('stripe_customer_id', customerId).maybeSingle();
    wsId = (ws as { id: string } | null)?.id ?? null;
  }

  if (!wsId) {
    const { data: ownerUser } = await admin
      .from('users').select('id').eq('stripe_customer_id', customerId).maybeSingle();
    if (ownerUser) {
      const { data: ws } = await admin
        .from('workspaces').select('id').eq('owner_id', (ownerUser as { id: string }).id).single();
      wsId = (ws as { id: string } | null)?.id ?? null;
    }
  }

  if (wsId) {
    await admin.from('workspaces').update({
      plan,
      minutes_limit:          PLAN_MINUTES[plan] ?? 50,
      is_white_label:         plan === 'scale',
      stripe_customer_id:     customerId,
      stripe_subscription_id: sub.id,
      stripe_price_id:        priceId ?? null,
      subscription_status:    sub.status,
    }).eq('id', wsId);

    if (plan !== 'free') {
      await admin.from('campaigns')
        .update({ status: 'active', pause_reason: null })
        .eq('workspace_id', wsId)
        .eq('pause_reason', 'minute_limit_reached');
    }
  }

  await admin.from('users').update({
    plan,
    stripe_subscription_id: sub.id,
    subscription_status:    sub.status,
  }).eq('stripe_customer_id', customerId);
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig  = req.headers.get('stripe-signature');

  if (!sig) return new NextResponse('Missing signature', { status: 400 });

  const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
  if (!webhookSecret) return new NextResponse('STRIPE_WEBHOOK_SECRET not configured', { status: 500 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return new NextResponse('Invalid signature', { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      await syncSubscription(admin, event.data.object as Stripe.Subscription);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      const { data: ws } = await admin
        .from('workspaces').select('id').eq('stripe_customer_id', customerId).maybeSingle();
      const wsId = (ws as { id: string } | null)?.id;

      if (wsId) {
        await admin.from('workspaces').update({
          plan: 'free',
          minutes_limit:          50,
          stripe_subscription_id: null,
          stripe_price_id:        null,
          subscription_status:    'canceled',
        }).eq('id', wsId);
      }

      await admin.from('users').update({
        plan: 'free',
        stripe_subscription_id: null,
        subscription_status:    'canceled',
      }).eq('stripe_customer_id', customerId);
      break;
    }

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      // Subscription checkout → sync immediately
      if (session.mode === 'subscription' && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await syncSubscription(admin, sub, session.metadata?.workspace_id);
        break;
      }

      // One-time top-up
      if (session.metadata?.type === 'voiceos_topup') {
        const workspaceId = session.metadata.workspace_id;
        const amountCents = Number(session.metadata.amount_cents ?? 0);
        if (!workspaceId || !amountCents) break;

        const { error } = await admin.rpc('increment_workspace_balance', {
          p_workspace_id: workspaceId,
          p_amount_cents: amountCents,
        });

        if (error) {
          const { data: current } = await admin
            .from('workspaces').select('stripe_balance_cents').eq('id', workspaceId).single();
          const existing = (current as { stripe_balance_cents: number } | null)?.stripe_balance_cents ?? 0;
          await admin.from('workspaces')
            .update({ stripe_balance_cents: existing + amountCents }).eq('id', workspaceId);
        }

        void Promise.resolve(
          admin.from('workspaces').select('owner_id, name').eq('id', workspaceId).single()
            .then(async ({ data: ws }) => {
              if (!ws) return;
              const { data: owner } = await admin.from('users')
                .select('email').eq('id', (ws as { owner_id: string }).owner_id).single();
              if (owner?.email) {
                sendTopUpReceipt({
                  to: owner.email,
                  workspaceName: (ws as { name: string }).name,
                  amount: `$${(amountCents / 100).toFixed(2)}`,
                }).catch(console.error);
              }
            })
        ).catch(() => null);

        void Promise.resolve(admin.from('billing_invoices').insert({
          workspace_id:      workspaceId,
          stripe_invoice_id: session.id,
          amount:            amountCents,
          currency:          session.currency ?? 'usd',
          status:            'paid',
          period_start:      new Date().toISOString(),
          period_end:        new Date().toISOString(),
          pdf_url:           null,
        })).catch(() => null);
      }
      break;
    }

    case 'invoice.paid': {
      const inv        = event.data.object as Stripe.Invoice;
      const customerId = inv.customer as string;

      // Find workspace via customer ID or owner lookup
      let wsId: string | null = null;
      const { data: ws } = await admin
        .from('workspaces').select('id').eq('stripe_customer_id', customerId).maybeSingle();
      wsId = (ws as { id: string } | null)?.id ?? null;

      if (!wsId) {
        const { data: ownerUser } = await admin
          .from('users').select('id').eq('stripe_customer_id', customerId).maybeSingle();
        if (ownerUser) {
          const { data: ownerWs } = await admin
            .from('workspaces').select('id').eq('owner_id', (ownerUser as { id: string }).id).single();
          wsId = (ownerWs as { id: string } | null)?.id ?? null;
        }
      }

      if (wsId) {
        await admin.from('billing_invoices').insert({
          workspace_id:      wsId,
          stripe_invoice_id: inv.id,
          amount:            inv.amount_paid,
          currency:          inv.currency,
          status:            'paid',
          period_start:      new Date((inv.period_start ?? 0) * 1000).toISOString(),
          period_end:        new Date((inv.period_end ?? 0) * 1000).toISOString(),
          pdf_url:           inv.invoice_pdf,
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const inv        = event.data.object as Stripe.Invoice;
      const customerId = inv.customer as string;

      const { data: userRow } = await admin
        .from('users').select('id, email').eq('stripe_customer_id', customerId).single();
      if (!userRow) break;
      const u = userRow as { id: string; email: string };

      const { data: wsRow } = await admin
        .from('workspaces').select('name').eq('owner_id', u.id).single();
      const workspaceName = (wsRow as { name: string } | null)?.name ?? 'your workspace';
      const amountStr     = `$${((inv.amount_due ?? 0) / 100).toFixed(2)}`;
      const appUrl        = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://voiceos.app';

      await admin.from('notifications').insert({
        user_id: u.id,
        type:    'payment_failed',
        title:   'Payment failed',
        message: `Your payment of ${amountStr} failed. Please update your payment method.`,
      });

      sendPaymentFailed({
        to: u.email,
        workspaceName,
        amount: amountStr,
        retryUrl: `${appUrl}/billing`,
      }).catch(console.error);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
