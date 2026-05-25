import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: ws } = await supabase
    .from('workspaces')
    .select('plan, minutes_used, minutes_limit, minutes_reset_at')
    .eq('owner_id', user.id)
    .single();

  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const minutesUsed = Number(ws.minutes_used ?? 0);
  const minutesLimit = Number(ws.minutes_limit ?? 0);
  const overageMinutes = Math.max(0, minutesUsed - minutesLimit);

  // Calculate next billing date (1st of next month)
  const now = new Date();
  const nextBillingDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  return NextResponse.json({
    minutes_used: minutesUsed,
    minutes_limit: minutesLimit,
    plan: ws.plan ?? 'free',
    overage_minutes: overageMinutes,
    next_billing_date: nextBillingDate,
    last_reset_at: ws.minutes_reset_at ?? null,
  });
}
