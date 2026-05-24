import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AdminMetricsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('users').select('is_superadmin').eq('id', user.id).single();
  if (!(profile as { is_superadmin: boolean } | null)?.is_superadmin) redirect('/dashboard');

  const admin = createAdminClient();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    { count: totalUsers },
    { count: proUsers },
    { count: scaleUsers },
    { count: callsToday },
    { count: callsMonth }
  ] = await Promise.all([
    admin.from('users').select('*', { count: 'exact', head: true }),
    admin.from('users').select('*', { count: 'exact', head: true }).eq('plan', 'pro'),
    admin.from('users').select('*', { count: 'exact', head: true }).eq('plan', 'scale'),
    admin.from('calls').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
    admin.from('calls').select('*', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString())
  ]);

  const mrr = ((proUsers ?? 0) * 97) + ((scaleUsers ?? 0) * 297);

  const metrics = [
    { label: 'Total Users', value: totalUsers?.toLocaleString() ?? '0' },
    { label: 'Pro Users', value: proUsers?.toLocaleString() ?? '0' },
    { label: 'Scale Users', value: scaleUsers?.toLocaleString() ?? '0' },
    { label: 'MRR', value: `$${mrr.toLocaleString()}` },
    { label: 'Calls Today', value: callsToday?.toLocaleString() ?? '0' },
    { label: 'Calls This Month', value: callsMonth?.toLocaleString() ?? '0' },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="border-b border-[#e0e0e0] bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-[#6b6b6b] hover:text-[#0a0a0a]">← Admin</Link>
          <h1 className="text-xl font-bold">Platform Metrics</h1>
        </div>
      </div>
      <div className="p-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        {metrics.map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-[#e0e0e0] bg-white p-5">
            <p className="text-sm text-[#6b6b6b]">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
