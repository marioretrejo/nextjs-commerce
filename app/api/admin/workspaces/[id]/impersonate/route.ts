/**
 * POST /api/admin/workspaces/[id]/impersonate
 *   Creates a 2-hour impersonation session, logs it, and returns a token.
 *   The client stores the token in a cookie; middleware reads it and attaches
 *   x-impersonation-workspace-id to every subsequent request.
 *
 * DELETE /api/admin/workspaces/[id]/impersonate
 *   Ends the session (sets ended_at) and writes audit log.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/admin-audit';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users')
    .select('is_superadmin').eq('id', user.id).single();
  if (!(profile as { is_superadmin: boolean } | null)?.is_superadmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: ws } = await admin.from('workspaces')
    .select('id, is_suspended').eq('id', workspaceId).single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const token     = crypto.randomBytes(32).toString('hex'); // 64-char hex
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from('impersonation_sessions').insert({
    admin_id:            user.id,
    target_workspace_id: workspaceId,
    token,
    expires_at:          expiresAt,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined;
  await writeAuditLog({
    actorId:     user.id,
    actorType:   'superadmin',
    action:      'impersonation.start',
    targetType:  'workspace',
    targetId:    workspaceId,
    workspaceId,
    metadata:    { expires_at: expiresAt },
    ip,
  });

  await admin.from('workspace_events').insert({
    workspace_id: workspaceId,
    event_type:   'impersonation_started',
    details:      { admin_id: user.id },
  });

  // Return token — client must set as HttpOnly cookie
  return NextResponse.json({ token, workspaceId, expiresAt });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users')
    .select('is_superadmin').eq('id', user.id).single();
  if (!(profile as { is_superadmin: boolean } | null)?.is_superadmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  await admin.from('impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('admin_id', user.id)
    .eq('target_workspace_id', workspaceId)
    .is('ended_at', null);

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined;
  await writeAuditLog({
    actorId:    user.id,
    actorType:  'superadmin',
    action:     'impersonation.end',
    targetType: 'workspace',
    targetId:   workspaceId,
    workspaceId,
    ip,
  });

  await admin.from('workspace_events').insert({
    workspace_id: workspaceId,
    event_type:   'impersonation_ended',
    details:      { admin_id: user.id },
  });

  return NextResponse.json({ ok: true });
}
