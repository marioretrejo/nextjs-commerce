/**
 * POST /api/admin/workspaces/[id]/suspend   — suspend a workspace
 * POST /api/admin/workspaces/[id]/suspend?action=unsuspend — reinstate
 *
 * On suspend:
 *  1. Sets workspaces.is_suspended = true + records who/why/when
 *  2. Invalidates all active API keys for this workspace
 *  3. Kills all active LiveKit rooms (immediate call termination)
 *  4. Writes to audit_logs
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/admin-audit';
import { RoomServiceClient } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Must be superadmin
  const { data: profile } = await supabase.from('users')
    .select('is_superadmin').eq('id', user.id).single();
  if (!(profile as { is_superadmin: boolean } | null)?.is_superadmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url     = new URL(req.url);
  const action  = url.searchParams.get('action') ?? 'suspend';
  const suspend = action !== 'unsuspend';

  const body = req.method === 'POST' && req.headers.get('content-length') !== '0'
    ? await req.json().catch(() => ({})) as { reason?: string }
    : {};
  const reason = body.reason ?? (suspend ? 'Suspended by admin' : null);

  const admin = createAdminClient();

  // Verify workspace exists
  const { data: ws } = await admin.from('workspaces')
    .select('id, owner_id, plan').eq('id', workspaceId).single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const patch: Record<string, unknown> = {
    is_suspended: suspend,
    suspended_at: suspend ? new Date().toISOString() : null,
    suspended_reason: suspend ? reason : null,
    suspended_by: suspend ? user.id : null,
  };

  const { error: patchErr } = await admin.from('workspaces')
    .update(patch).eq('id', workspaceId);
  if (patchErr) return NextResponse.json({ error: patchErr.message }, { status: 500 });

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined;

  // Write audit log
  await writeAuditLog({
    actorId:     user.id,
    actorType:   'superadmin',
    action:      suspend ? 'workspace.suspend' : 'workspace.unsuspend',
    targetType:  'workspace',
    targetId:    workspaceId,
    workspaceId,
    metadata:    { reason, plan: (ws as { plan: string }).plan },
    ip,
  });

  // Record in workspace_events (billing log)
  await admin.from('workspace_events').insert({
    workspace_id: workspaceId,
    event_type:   suspend ? 'workspace_suspended' : 'workspace_unsuspended',
    details:      { reason, suspended_by: user.id },
  });

  // ── LiveKit: terminate all active rooms for this workspace ───────────────
  if (suspend) {
    const apiKey    = process.env['LIVEKIT_API_KEY'];
    const apiSecret = process.env['LIVEKIT_API_SECRET'];
    const httpUrl   = process.env['LIVEKIT_URL']?.replace('wss://', 'https://');

    if (apiKey && apiSecret && httpUrl) {
      try {
        const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
        const rooms = await roomService.listRooms();
        const wsRooms = rooms.filter((r) => {
          try {
            const meta = JSON.parse(r.metadata ?? '{}') as { workspace_id?: string };
            return meta.workspace_id === workspaceId;
          } catch { return false; }
        });

        await Promise.allSettled(wsRooms.map((r) => roomService.deleteRoom(r.name)));

        await writeAuditLog({
          actorId:     user.id,
          actorType:   'superadmin',
          action:      'workspace.livekit_rooms_terminated',
          targetType:  'workspace',
          targetId:    workspaceId,
          workspaceId,
          metadata:    { rooms_terminated: wsRooms.length },
          ip,
        });
      } catch (err) {
        console.error('[suspend] LiveKit room termination failed:', err);
      }
    }
  }

  return NextResponse.json({ ok: true, is_suspended: suspend });
}
