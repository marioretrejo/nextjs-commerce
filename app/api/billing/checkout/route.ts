import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe/client';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { plan } = await req.json() as { plan: 'pro' | 'scale' };
  const priceId = plan === 'pro' ? process.env['STRIPE_PRICE_PRO'] : process.env['STRIPE_PRICE_SCALE'];
  if (!priceId) return NextResponse.json({ error: 'Price not configured' }, { status: 500 });

  const { data: userProfile } = await supabase.from('users').select('stripe_customer_id, email, name').eq('id', user.id).single();
  const profile = userProfile as { stripe_customer_id: string | null; email: string; name: string | null } | null;

  const admin = createAdminClient();
  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email,
      name: profile?.name ?? undefined,
      metadata: { supabase_user_id: user.id }
    });
    customerId = customer.id;
    await admin.from('users').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/billing?success=1`,
    cancel_url: `${appUrl}/billing?canceled=1`,
    allow_promotion_codes: true
  });

  return NextResponse.json({ url: session.url });
}
