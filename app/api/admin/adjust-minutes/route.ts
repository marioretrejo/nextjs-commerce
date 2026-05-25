import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('is_superadmin')
    .eq('id', user.id)
    .single();

  if (!(profile as { is_superadmin: boolean } | null)?.is_superadmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as {
    workspace_id: string;
    minutes_used?: number;
    minutes_limit?: number;
    bonus_minutes?: number;
    reason: string;
  };

  if (!body.workspace_id || !body.reason) {
    return NextResponse.json({ error: 'workspace_id and reason are required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch current values
  const { data: ws } = await admin
    .from('workspaces')
    .select('minutes_used, minutes_limit')
    .eq('id', body.workspace_id)
    .single();

  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const current = ws as { minutes_used: number; minutes_limit: number };
  const newUsed  = body.minutes_used  !== undefined ? body.minutes_used
    : body.bonus_minutes !== undefined ? Number(current.minutes_used) - body.bonus_minutes
    : undefined;
  const newLimit = body.minutes_limit !== undefined ? body.minutes_limit : undefined;

  const patch: Record<string, unknown> = {};
  if (newUsed  !== undefined) patch['minutes_used']    = Math.max(0, newUsed);
  if (newLimit !== undefined) patch['minutes_limit']   = newLimit;
  if (newUsed  !== undefined && Number(newUsed) < (newLimit ?? current.minutes_limit)) {
    patch['overage_blocked'] = false;
  }

  if (Object.keys(patch).length > 0) {
    await admin.from('workspaces').update(patch).eq('id', body.workspace_id);
  }

  // Log in workspace_events
  await admin.from('workspace_events').insert({
    workspace_id: body.workspace_id,
    event_type: 'minutes_adjusted',
    details: {
      adjusted_by: user.id,
      reason: body.reason,
      previous_used: current.minutes_used,
      previous_limit: current.minutes_limit,
      new_used: patch['minutes_used'] ?? current.minutes_used,
      new_limit: patch['minutes_limit'] ?? current.minutes_limit,
    },
  });

  return NextResponse.json({ ok: true });
}
