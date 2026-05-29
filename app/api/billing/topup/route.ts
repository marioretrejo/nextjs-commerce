/**
 * POST /api/billing/topup
 *
 * Creates a Stripe Checkout session (one-time payment) to add prepaid
 * balance to the workspace. Minimum $10.
 *
 * Body: { amount_cents: number }  (min 1000, i.e. $10.00)
 *
 * On success → redirect to /dashboard?topup=success
 * Stripe webhook `checkout.session.completed` credits stripe_balance_cents.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe/client';
import { NextResponse } from 'next/server';

const MIN_TOPUP_CENTS = 1000; // $10.00

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { amount_cents?: number };
  try { body = await req.json(); } catch { body = {}; }

  const amount = Math.max(Number(body.amount_cents ?? MIN_TOPUP_CENTS), MIN_TOPUP_CENTS);

  // Get or create Stripe customer
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('stripe_customer_id, email, name')
    .eq('id', user.id)
    .single();
  const p = profile as { stripe_customer_id: string | null; email: string; name: string | null } | null;

  let customerId = p?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: p?.email ?? user.email,
      name: p?.name ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await admin.from('users').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  // Get workspace id for metadata
  const { data: ws } = await admin
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single();
  const workspaceId = (ws as { id: string } | null)?.id ?? '';

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'VoiceOS Account Credit',
          description: `$${(amount / 100).toFixed(2)} prepaid balance — used for AI voice minutes.`,
        },
        unit_amount: amount,
      },
      quantity: 1,
    }],
    payment_intent_data: {
      metadata: {
        type: 'voiceos_topup',
        workspace_id: workspaceId,
        amount_cents: String(amount),
      },
    },
    metadata: {
      type: 'voiceos_topup',
      workspace_id: workspaceId,
      amount_cents: String(amount),
    },
    success_url: `${appUrl}/dashboard?topup=success`,
    cancel_url:  `${appUrl}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}
