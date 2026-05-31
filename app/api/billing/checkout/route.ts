import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe/client';
import { getUserWorkspaces } from '@/lib/workspace';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const CheckoutSchema = z.object({
  plan: z.enum(['pro', 'scale']),
  priceId: z.string().optional(), // direct priceId override
});

const PRICE_MAP: Record<string, string | undefined> = {
  pro:   process.env['STRIPE_PRICE_PRO'],
  scale: process.env['STRIPE_PRICE_SCALE'],
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as unknown;
  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { plan, priceId: explicitPriceId } = parsed.data;
  const priceId = explicitPriceId ?? PRICE_MAP[plan];

  if (!priceId) {
    return NextResponse.json(
      { error: `STRIPE_PRICE_${plan.toUpperCase()} is not configured. Add it to Vercel env vars.` },
      { status: 500 }
    );
  }

  const [workspaces, { data: userProfile }] = await Promise.all([
    getUserWorkspaces(),
    supabase.from('users').select('stripe_customer_id, email, name').eq('id', user.id).single(),
  ]);

  const workspace = workspaces[0];
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 });

  const profile = userProfile as { stripe_customer_id: string | null; email: string; name: string | null } | null;
  const admin = createAdminClient();

  // Prefer workspace-level customer, fall back to user-level
  let customerId = (workspace as { stripe_customer_id?: string | null }).stripe_customer_id
    ?? profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email,
      name: profile?.name ?? undefined,
      metadata: {
        supabase_user_id: user.id,
        workspace_id: workspace.id,
      },
    });
    customerId = customer.id;
    // Persist on both workspace and user
    await Promise.all([
      admin.from('workspaces').update({ stripe_customer_id: customerId }).eq('id', workspace.id),
      admin.from('users').update({ stripe_customer_id: customerId }).eq('id', user.id),
    ]);
  }

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/billing?success=1`,
    cancel_url:  `${appUrl}/billing?canceled=1`,
    allow_promotion_codes: true,
    metadata: {
      workspace_id: workspace.id,
      plan,
    },
    subscription_data: {
      metadata: {
        workspace_id: workspace.id,
        plan,
      },
    },
  });

  return NextResponse.json({ url: session.url });
}
