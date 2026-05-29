/**
 * Thin wrapper around write_audit_log() for server-side usage in API routes.
 * Always uses the admin client (service role) so RLS is bypassed.
 */
import { createAdminClient } from '@/lib/supabase/admin';

export interface AuditPayload {
  actorId:     string;
  actorType?:  'superadmin' | 'user' | 'system' | 'api';
  action:      string;
  targetType?: string;
  targetId?:   string;
  workspaceId?: string;
  metadata?:   Record<string, unknown>;
  ip?:         string;
}

export async function writeAuditLog(p: AuditPayload): Promise<void> {
  const admin = createAdminClient();
  await admin.rpc('write_audit_log', {
    p_actor_id:    p.actorId,
    p_actor_type:  p.actorType ?? 'superadmin',
    p_action:      p.action,
    p_target_type: p.targetType ?? null,
    p_target_id:   p.targetId   ?? null,
    p_workspace_id: p.workspaceId ?? null,
    p_metadata:    p.metadata ?? {},
    p_ip:          p.ip ?? null,
  });
}
