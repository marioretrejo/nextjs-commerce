import { createClient } from '@/lib/supabase/server';
import type { User, Workspace } from '@/lib/supabase/types';
import { redirect } from 'next/navigation';
import { cache } from 'react';

export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return data;
});

export const getWorkspace = cache(async (workspaceId: string): Promise<Workspace | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();

  return data;
});

export const getUserWorkspaces = cache(async (): Promise<Workspace[]> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true });

  return data ?? [];
});

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.is_suspended) redirect('/suspended');
  return user;
}

export async function requireWorkspace(workspaceId: string): Promise<Workspace> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) redirect('/dashboard');
  return workspace;
}

// Plan limits
export const PLAN_LIMITS = {
  free:  { agents: 1,         minutes: 50,   campaigns: 1  },
  pro:   { agents: 5,         minutes: 1000, campaigns: 20 },
  scale: { agents: Infinity,  minutes: 5000, campaigns: Infinity }
} as const;

export function canAddAgent(plan: string, currentAgentCount: number): boolean {
  const limit = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;
  return currentAgentCount < limit.agents;
}

export function minutesExceeded(workspace: Workspace): boolean {
  return workspace.minutes_used >= workspace.minutes_limit;
}

export function minutesWarning(workspace: Workspace): boolean {
  return workspace.minutes_used / workspace.minutes_limit >= 0.8;
}
