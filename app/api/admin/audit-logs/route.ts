/**
 * GET /api/admin/audit-logs?workspace_id=&action=&limit=50&offset=0
 * Returns paginated audit log entries. Superadmin only.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: p } = await supabase.from('users')
    .select('is_superadmin').eq('id', user.id).single();
  if (!(p as { is_superadmin: boolean } | null)?.is_superadmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url    = new URL(req.url);
  const wsId   = url.searchParams.get('workspace_id');
  const action = url.searchParams.get('action');
  const limit  = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const offset = Number(url.searchParams.get('offset') ?? 0);

  const admin = createAdminClient();
  let q = admin
    .from('audit_logs')
    .select('*, actor:actor_id(id, name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (wsId)   q = q.eq('workspace_id', wsId);
  if (action) q = q.eq('action', action);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ logs: data ?? [], total: count ?? 0 });
}
