/**
 * POST /api/admin/workspaces/:id/enterprise-quota
 *
 * Assigns (or clears) an Enterprise minute cap for a workspace.
 * Body: { minute_cap: number | null }
 * Superadmin only. Logs to audit_logs.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

type Params = Promise<{ id: string }>;

export async function POST(req: Request, { params }: { params: Params }) {
  const { id: workspaceId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from('users').select('is_superadmin').eq('id', user.id).single();
  if (!(profile as { is_superadmin: boolean } | null)?.is_superadmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { minute_cap?: number | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const minuteCap = body.minute_cap === null ? null : Number(body.minute_cap);
  if (minuteCap !== null && (isNaN(minuteCap) || minuteCap < 0)) {
    return NextResponse.json({ error: 'minute_cap must be a positive integer or null.' }, { status: 400 });
  }

  const { error } = await admin
    .from('workspaces')
    .update({ minute_cap: minuteCap })
    .eq('id', workspaceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log
  void Promise.resolve(
    admin.from('audit_logs').insert({
      actor_id:   user.id,
      action:     minuteCap === null ? 'enterprise_quota_cleared' : 'enterprise_quota_assigned',
      target_id:  workspaceId,
      target_type: 'workspace',
      metadata:   { minute_cap: minuteCap },
    })
  ).catch(() => null);

  return NextResponse.json({ ok: true, minute_cap: minuteCap });
}
