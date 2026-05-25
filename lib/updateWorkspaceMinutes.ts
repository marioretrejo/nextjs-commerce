import { createAdminClient } from '@/lib/supabase/admin';

export async function updateWorkspaceMinutes(
  workspace_id: string,
  duration_seconds: number
): Promise<void> {
  const admin = createAdminClient();
  const duration_minutes = duration_seconds / 60.0;

  // Atomic increment
  const { data: ws } = await admin
    .from('workspaces')
    .select('minutes_used, minutes_limit, plan, owner_id')
    .eq('id', workspace_id)
    .single();

  if (!ws) return;

  const prevUsed  = Number(ws.minutes_used ?? 0);
  const limit     = Number(ws.minutes_limit ?? 0);
  const newUsed   = prevUsed + duration_minutes;
  const prevPct   = limit > 0 ? (prevUsed / limit) * 100 : 0;
  const newPct    = limit > 0 ? (newUsed  / limit) * 100 : 0;

  const updatePayload: Record<string, unknown> = { minutes_used: newUsed };

  // Block further calls if limit reached
  if (newUsed >= limit && prevUsed < limit) {
    updatePayload['overage_blocked'] = true;
  }

  await admin.from('workspaces').update(updatePayload).eq('id', workspace_id);

  // Threshold notifications
  const crossed80  = prevPct < 80  && newPct >= 80;
  const crossed90  = prevPct < 90  && newPct >= 90;
  const crossed100 = prevPct < 100 && newPct >= 100;

  if (crossed100) {
    await Promise.all([
      admin.from('notifications').insert({
        user_id: ws.owner_id,
        type: 'minutes_100',
        title: 'Minute limit reached',
        body: `You've used all ${limit} minutes on your plan. All outbound calls have been paused.`,
        read: false,
      }),
      admin.from('workspace_events').insert({
        workspace_id,
        event_type: 'limit_reached',
        details: { minutes_used: newUsed, minutes_limit: limit, plan: ws.plan },
      }),
      // Pause all active campaigns
      admin.from('campaigns')
        .update({ status: 'paused', pause_reason: 'minute_limit_reached' })
        .eq('workspace_id', workspace_id)
        .eq('status', 'active'),
    ]);
  } else if (crossed90) {
    await admin.from('notifications').insert({
      user_id: ws.owner_id,
      type: 'minutes_90',
      title: '90% of minutes used',
      body: `Only ${Math.max(0, limit - newUsed).toFixed(0)} minutes remaining. Your calls will stop at ${limit} minutes.`,
      read: false,
    });
  } else if (crossed80) {
    await admin.from('notifications').insert({
      user_id: ws.owner_id,
      type: 'minutes_80',
      title: '80% of minutes used',
      body: `You've used ${newUsed.toFixed(0)} of your ${limit} minutes. ${Math.max(0, limit - newUsed).toFixed(0)} minutes remaining.`,
      read: false,
    });
  }
}
