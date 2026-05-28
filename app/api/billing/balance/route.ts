/**
 * GET /api/billing/balance
 *
 * Returns the current workspace's billing state:
 *   { balance_cents, minute_cap, workspace_id }
 *
 * Used by client components that need to check before enabling paid features.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from('workspaces')
    .select('id, stripe_balance_cents, minute_cap')
    .eq('owner_id', user.id)
    .single();

  if (!data) return NextResponse.json({ balance_cents: 0, minute_cap: null, workspace_id: '' });

  const ws = data as { id: string; stripe_balance_cents: number; minute_cap: number | null };
  return NextResponse.json({
    workspace_id:  ws.id,
    balance_cents: ws.stripe_balance_cents ?? 0,
    minute_cap:    ws.minute_cap ?? null,
  });
}
