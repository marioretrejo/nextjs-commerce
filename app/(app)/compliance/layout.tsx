import { createClient } from '@/lib/supabase/server';
import { getUserWorkspaces } from '@/lib/workspace';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

export default async function ComplianceLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const workspaces = await getUserWorkspaces();
  const workspace = workspaces[0];
  if (!workspace) redirect('/dashboard');

  const ws = workspace as unknown as { has_compliance_qa?: boolean; is_superadmin?: boolean };

  // Superadmins always have access for testing
  const { data: profile } = await supabase.from('users').select('is_superadmin').eq('id', user.id).single();
  const isSuperadmin = (profile as { is_superadmin: boolean } | null)?.is_superadmin ?? false;

  if (!ws.has_compliance_qa && !isSuperadmin) {
    redirect('/dashboard?upgrade=compliance_qa');
  }

  return <>{children}</>;
}
