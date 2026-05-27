import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { CommandPalette } from '@/components/command-palette';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import { MinuteAlerts } from '@/components/minute-usage/minute-alerts';
import type { User, WorkspaceBranding } from '@/lib/supabase/types';
import { createClient } from '@/lib/supabase/server';
import { getUserWorkspaces } from '@/lib/workspace';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) redirect('/login?callbackUrl=/dashboard');

  const [{ data: rawProfile }, workspaces, { data: notifications }] = await Promise.all([
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    getUserWorkspaces(),
    supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', authUser.id)
      .eq('read', false)
  ]);

  const userProfile = rawProfile as User | null;

  if (!userProfile) redirect('/login?callbackUrl=/dashboard');
  if (userProfile.is_suspended) redirect('/suspended');

  const workspace = workspaces[0];
  if (!workspace) redirect('/onboarding');

  const unread = notifications?.length ?? 0;

  // Fetch workspace branding
  const branding = (workspace.branding ?? null) as WorkspaceBranding | null;
  const appName = branding?.app_name ?? 'VoiceOS';
  const primaryColor = branding?.primary_color ?? '#0a0a0a';

  return (
    <div
      className="flex min-h-screen bg-[#f5f5f5]"
      style={{ '--brand': primaryColor } as React.CSSProperties}
    >
      <div className="hidden md:block">
        <Sidebar isSuperadmin={userProfile.is_superadmin} appName={appName} />
      </div>
      <div className="flex flex-1 flex-col md:pl-56">
        <Header user={userProfile} workspace={workspace} unreadNotifications={unread} />
        <main className="flex-1 pt-14 pb-16 md:pb-0">
          {children}
        </main>
      </div>
      <MobileNav />
      <CommandPalette />
      {!userProfile.onboarding_completed && (
        <OnboardingWizard userId={userProfile.id} userName={userProfile.name} workspaceId={workspace.id} />
      )}
      <MinuteAlerts
        workspaceId={workspace.id}
        initialUsed={Number(workspace.minutes_used)}
        limit={Number(workspace.minutes_limit)}
        plan={workspace.plan}
      />
    </div>
  );
}
