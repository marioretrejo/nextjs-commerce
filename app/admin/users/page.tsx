import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AdjustMinutesModal } from '@/components/admin/adjust-minutes-modal';

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('users').select('is_superadmin').eq('id', user.id).single();
  if (!(profile as { is_superadmin: boolean } | null)?.is_superadmin) redirect('/dashboard');

  const admin = createAdminClient();
  const { data: users } = await admin
    .from('users')
    .select('id, email, name, plan, minutes_used, minutes_limit, is_suspended, created_at, subscription_status')
    .order('created_at', { ascending: false })
    .limit(200);

  const userList = (users ?? []) as {
    id: string; email: string; name: string | null; plan: string;
    minutes_used: number; minutes_limit: number; is_suspended: boolean;
    created_at: string; subscription_status: string | null;
  }[];

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="border-b border-[#e0e0e0] bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-[#6b6b6b] hover:text-[#0a0a0a]">← Admin</Link>
          <h1 className="text-xl font-bold">All Users</h1>
          <span className="ml-auto rounded-full bg-[#f5f5f5] px-2.5 py-0.5 text-xs font-medium">{userList.length}</span>
        </div>
      </div>

      <div className="p-6">
        <div className="rounded-lg border border-[#e0e0e0] bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f5f5f5] border-b border-[#e0e0e0]">
              <tr>
                {['User', 'Plan', 'Minutes', 'Status', 'Joined', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#6b6b6b]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {userList.map((u) => (
                <tr key={u.id} className="border-b border-[#e0e0e0] hover:bg-[#f5f5f5]">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.name ?? '—'}</p>
                    <p className="text-xs text-[#6b6b6b]">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.plan === 'scale' || u.plan === 'pro' ? 'bg-[#0a0a0a] text-white' : 'bg-[#f5f5f5] text-[#6b6b6b]'}`}>
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {u.minutes_used} / {u.minutes_limit}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.is_suspended ? 'bg-[#0a0a0a] text-white' : 'bg-[#f5f5f5] text-[#0a0a0a]'}`}>
                      {u.is_suspended ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6b6b6b]">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <AdjustMinutesModal
                      workspaceId={u.id}
                      currentUsed={u.minutes_used}
                      currentLimit={u.minutes_limit}
                      userName={u.name ?? u.email}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
