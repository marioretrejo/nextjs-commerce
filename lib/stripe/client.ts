import Stripe from 'stripe';

export const stripe = new Stripe(process.env['STRIPE_SECRET_KEY']!, {
  apiVersion: '2025-02-24.acacia'
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
