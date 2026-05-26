import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe/client';
import { sendPaymentFailed } from '@/lib/email';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

const PLAN_MINUTES: Record<string, number> = { pro: 1000, scale: 5000, free: 50 };

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !process.env['STRIPE_WEBHOOK_SECRET']) {
    return new NextResponse('Missing signature', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env['STRIPE_WEBHOOK_SECRET']!);
  } catch {
    return new NextResponse('Invalid signature', { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price.id;
      let plan = 'free';
      if (priceId === process.env['STRIPE_PRICE_PRO']) plan = 'pro';
      else if (priceId === process.env['STRIPE_PRICE_SCALE']) plan = 'scale';

      await admin.from('workspaces')
        .update({
          plan,
          minutes_limit: PLAN_MINUTES[plan] ?? 50,
          is_white_label: plan === 'scale'
        })
        .eq('owner_id', (await admin.from('users').select('id').eq('stripe_customer_id', sub.customer as string).single()).data?.id ?? '');

      await admin.from('users').update({
        plan,
        stripe_subscription_id: sub.id,
        subscription_status: sub.status
      }).eq('stripe_customer_id', sub.customer as string);

      // Resume campaigns paused due to minute limit when user upgrades
      if (plan !== 'free') {
        const { data: workspace } = await admin.from('workspaces')
          .select('id')
          .eq('owner_id', (await admin.from('users').select('id').eq('stripe_customer_id', sub.customer as string).single()).data?.id ?? '')
          .single();
        if (workspace) {
          await admin.from('campaigns')
            .update({ status: 'active', pause_reason: null })
            .eq('workspace_id', (workspace as { id: string }).id)
            .eq('pause_reason', 'minute_limit_reached');
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const { data: user } = await admin.from('users').select('id').eq('stripe_customer_id', sub.customer as string).single();
      if (user) {
        const userId = (user as { id: string }).id;
        await admin.from('users').update({ plan: 'free', subscription_status: 'canceled' }).eq('id', userId);
        await admin.from('workspaces').update({ plan: 'free', minutes_limit: 50 }).eq('owner_id', userId);
      }
      break;
    }

    case 'invoice.paid': {
      const inv = event.data.object as Stripe.Invoice;
      const { data: user } = await admin.from('users').select('id').eq('stripe_customer_id', inv.customer as string).single();
      if (!user) break;

      const userId = (user as { id: string }).id;
      const { data: ws } = await admin.from('workspaces').select('id').eq('owner_id', userId).single();
      if (!ws) break;

      await admin.from('billing_invoices').insert({
        workspace_id: (ws as { id: string }).id,
        stripe_invoice_id: inv.id,
        amount: inv.amount_paid,
        currency: inv.currency,
        status: 'paid',
        period_start: new Date((inv.period_start ?? 0) * 1000).toISOString(),
        period_end: new Date((inv.period_end ?? 0) * 1000).toISOString(),
        pdf_url: inv.invoice_pdf
      });
      break;
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice;
      const { data: user } = await admin.from('users').select('id, email').eq('stripe_customer_id', inv.customer as string).single();
      if (!user) break;
      const u = user as { id: string; email: string };

      const { data: ws } = await admin.from('workspaces').select('name').eq('owner_id', u.id).single();
      const workspaceName = (ws as { name: string } | null)?.name ?? 'your workspace';
      const amountStr = `$${((inv.amount_due ?? 0) / 100).toFixed(2)}`;
      const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://voiceos.app';

      // In-app notification
      await admin.from('notifications').insert({
        user_id: u.id,
        type: 'payment_failed',
        title: 'Payment failed',
        message: `Your payment of ${amountStr} failed. Please update your payment method.`
      });

      // Email notification
      sendPaymentFailed({
        to: u.email,
        workspaceName,
        amount: amountStr,
        retryUrl: `${appUrl}/billing`
      }).catch(console.error);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
