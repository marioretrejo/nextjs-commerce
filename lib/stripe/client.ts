import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!_stripe) {
    const key = process.env['STRIPE_SECRET_KEY'];
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
    _stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
  }
  return _stripe;
}

// Legacy named export — lazily initialized so Next.js build doesn't throw without env vars
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_t, prop) {
    return Reflect.get(getStripeClient(), prop);
  }
});

export const PLANS = {
  pro: {
    name: 'Pro',
    price: 9700,
    interval: 'month' as const,
    agents: 5,
    minutes: 1000,
    priceId: process.env['STRIPE_PRICE_PRO']!
  },
  scale: {
    name: 'Scale',
    price: 29700,
    interval: 'month' as const,
    agents: Infinity,
    minutes: 5000,
    priceId: process.env['STRIPE_PRICE_SCALE']!
  }
} as const;
