'use server';

import { redirect } from 'next/navigation';
import type { Plan } from '@/lib/supabase/types';

export async function handleUpgrade(plan: Plan) {
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? '';
  const res = await fetch(`${appUrl}/api/stripe/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? 'Checkout failed — please try again.');
  }
  const d = await res.json() as { url: string };
  if (d.url) redirect(d.url);
  throw new Error('No checkout URL returned — please try again.');
}

export async function handlePortal() {
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? '';
  const res = await fetch(`${appUrl}/api/stripe/portal`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? 'Portal access failed — please try again.');
  }
  const d = await res.json() as { url: string };
  if (d.url) redirect(d.url);
  throw new Error('No portal URL returned — please try again.');
}
