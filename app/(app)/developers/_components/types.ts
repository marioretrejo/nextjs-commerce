/** Shared types for the developers page. */

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
}
