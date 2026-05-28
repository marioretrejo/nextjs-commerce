export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { WorkspaceCommandCenter } from './WorkspaceCommandCenter';

export default async function AdminWorkspacesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('users')
    .select('is_superadmin').eq('id', user.id).single();
  if (!(me as { is_superadmin: boolean } | null)?.is_superadmin) redirect('/dashboard');

  const admin = createAdminClient();
  const { data: workspaces } = await admin
    .from('workspaces')
    .select('id, name, plan, minutes_used, minutes_limit, is_suspended, suspended_reason, suspended_at, active_calls, concurrent_calls_limit, owner_id, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  // Fetch owner emails
  const ownerIds = [...new Set((workspaces ?? []).map((w) => (w as { owner_id: string }).owner_id))];
  const { data: owners } = ownerIds.length
    ? await admin.from('users').select('id, name, email').in('id', ownerIds)
    : { data: [] };
  const ownerMap = Object.fromEntries((owners ?? []).map((u) => [u.id, u]));

  // Feature flags per workspace
  const { data: flags } = await admin
    .from('workspace_feature_flags')
    .select('workspace_id, flag, enabled, value')
    .in('workspace_id', (workspaces ?? []).map((w) => w.id));

  const flagsByWs: Record<string, { flag: string; enabled: boolean; value: unknown }[]> = {};
  for (const f of flags ?? []) {
    (flagsByWs[f.workspace_id] ??= []).push(f);
  }

  return (
    <WorkspaceCommandCenter
      workspaces={(workspaces ?? []).map((w) => ({
        ...w,
        owner: ownerMap[(w as { owner_id: string }).owner_id] ?? null,
        flags: flagsByWs[w.id] ?? [],
      }))}
    />
  );
}
