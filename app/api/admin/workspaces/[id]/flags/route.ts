/**
 * GET  /api/admin/workspaces/[id]/flags        — list all flags for workspace
 * PATCH /api/admin/workspaces/[id]/flags       — upsert one or more flags
 *   Body: { flag: string, enabled: boolean, value?: object }
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/admin-audit';
import { NextResponse } from 'next/server';

async function requireSuperadmin(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: p } = await supabase.from('users').select('is_superadmin').eq('id', user.id).single();
  if (!(p as { is_superadmin: boolean } | null)?.is_superadmin) {
    return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, error: null };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const { user, error } = await requireSuperadmin(req);
  if (error) return error;

  void user; // auth already verified
  const admin = createAdminClient();
  const { data } = await admin.from('workspace_feature_flags')
    .select('*').eq('workspace_id', workspaceId);
  return NextResponse.json(data ?? []);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const { user, error } = await requireSuperadmin(req);
  if (!user || error) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { flag: string; enabled: boolean; value?: Record<string, unknown> };
  const { flag, enabled, value = null } = body;

  if (!flag || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'flag and enabled are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error: upsertErr } = await admin.from('workspace_feature_flags')
    .upsert(
      { workspace_id: workspaceId, flag, enabled, value, updated_by: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id,flag' }
    )
    .select()
    .single();

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined;
  await writeAuditLog({
    actorId:     user.id,
    actorType:   'superadmin',
    action:      'feature_flag.update',
    targetType:  'workspace',
    targetId:    workspaceId,
    workspaceId,
    metadata:    { flag, enabled, value },
    ip,
  });

  return NextResponse.json(data);
}
