import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('stripe_customer_id').eq('id', user.id).single();
  const customerId = (profile as { stripe_customer_id: string | null } | null)?.stripe_customer_id;

  if (!customerId) return NextResponse.json({ error: 'No billing account found' }, { status: 400 });

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/billing`
  });

  return NextResponse.json({ url: session.url });
}
