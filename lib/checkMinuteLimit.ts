import { createClient } from '@/lib/supabase/server';

export type MinuteLimitStatus = 'ok' | 'warning_80' | 'warning_90' | 'blocked';

export interface MinuteLimitResult {
  allowed: boolean;
  minutes_used: number;
  minutes_limit: number;
  minutes_remaining: number;
  percentage: number;
  status: MinuteLimitStatus;
}

export async function checkMinuteLimit(workspace_id: string): Promise<MinuteLimitResult> {
  const supabase = await createClient();
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('minutes_used, minutes_limit, overage_blocked')
    .eq('id', workspace_id)
    .single();

  const minutesUsed  = Number(workspace?.minutes_used  ?? 0);
  const minutesLimit = Number(workspace?.minutes_limit ?? 0);
  const blocked      = Boolean(workspace?.overage_blocked);

  const percentage       = minutesLimit > 0 ? (minutesUsed / minutesLimit) * 100 : 0;
  const minutes_remaining = Math.max(0, minutesLimit - minutesUsed);

  const status: MinuteLimitStatus =
    blocked || percentage >= 100 ? 'blocked'
    : percentage >= 90           ? 'warning_90'
    : percentage >= 80           ? 'warning_80'
    : 'ok';

  return {
    allowed: !blocked && minutesUsed < minutesLimit,
    minutes_used: minutesUsed,
    minutes_limit: minutesLimit,
    minutes_remaining,
    percentage,
    status,
  };
}

export function minuteLimitBlockedResponse(result: MinuteLimitResult) {
  const resetDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return {
    error: 'MINUTE_LIMIT_REACHED',
    message: `You have used all ${result.minutes_limit} minutes in your plan.`,
    minutes_used: result.minutes_used,
    minutes_limit: result.minutes_limit,
    upgrade_url: '/billing',
    reset_date: resetDate,
  };
}
