/**
 * POST /api/admin/workspaces/:id/billing-status
 *
 * Changes the billing_status of a workspace.
 * Body: { status: 'active' | 'suspended_for_nonpayment' }
 * Superadmin only. Logs to audit_logs.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const VALID_STATUSES = ['active', 'suspended_for_nonpayment'] as const;
type BillingStatus = (typeof VALID_STATUSES)[number];

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

  let body: { status?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const newStatus = body.status as BillingStatus;
  if (!VALID_STATUSES.includes(newStatus)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const { error } = await admin
    .from('workspaces')
    .update({ billing_status: newStatus })
    .eq('id', workspaceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void Promise.resolve(
    admin.from('audit_logs').insert({
      actor_id:    user.id,
      action:      `billing_status_changed_to_${newStatus}`,
      target_id:   workspaceId,
      target_type: 'workspace',
      metadata:    { billing_status: newStatus },
    })
  ).catch(() => null);

  return NextResponse.json({ ok: true, billing_status: newStatus });
}
