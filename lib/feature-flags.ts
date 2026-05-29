/**
 * Server-side feature flag helper.
 *
 * Usage in API routes / server components:
 *   const flags = await getWorkspaceFlags(workspaceId);
 *   if (!flags.allow_outbound_calls) return 403;
 */
import { createAdminClient } from '@/lib/supabase/admin';

export type FlagName =
  | 'allow_outbound_calls'
  | 'allow_sip_trunking'
  | 'allow_custom_voices'
  | 'allow_api_access'
  | 'allow_campaign_dialer'
  | 'max_concurrent_channels'
  | 'max_agents';

export interface FeatureFlag {
  flag:    string;
  enabled: boolean;
  value:   Record<string, unknown> | null;
}

export type WorkspaceFlags = Record<string, FeatureFlag>;

export async function getWorkspaceFlags(workspaceId: string): Promise<WorkspaceFlags> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('workspace_feature_flags')
    .select('flag, enabled, value')
    .eq('workspace_id', workspaceId);

  const map: WorkspaceFlags = {};
  for (const row of data ?? []) {
    map[row.flag] = {
      flag:    row.flag,
      enabled: row.enabled,
      value:   row.value as Record<string, unknown> | null,
    };
  }
  return map;
}

export function flagEnabled(flags: WorkspaceFlags, name: FlagName): boolean {
  return flags[name]?.enabled ?? true; // default permissive if flag not set
}

export function flagValue<T = unknown>(flags: WorkspaceFlags, name: FlagName, key: string, def: T): T {
  const v = flags[name]?.value;
  if (!v || !(key in v)) return def;
  return v[key] as T;
}
