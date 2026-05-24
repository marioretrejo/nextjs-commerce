import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import type { User } from '@/lib/supabase/types';
import { createClient } from '@/lib/supabase/server';
import { getUserWorkspaces } from '@/lib/workspace';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) redirect('/login');

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

  if (!userProfile) redirect('/login');
  if (userProfile.is_suspended) redirect('/suspended');

  const workspace = workspaces[0];
  if (!workspace) redirect('/login');

  const unread = notifications?.length ?? 0;

  return (
    <div className="flex min-h-screen bg-[#f5f5f5]">
      <Sidebar isSuperadmin={userProfile.is_superadmin} />
      <div className="flex flex-1 flex-col pl-56">
        <Header user={userProfile} workspace={workspace} unreadNotifications={unread} />
        <main className="flex-1 pt-14">
          {children}
        </main>
      </div>
    </div>
  );
}
