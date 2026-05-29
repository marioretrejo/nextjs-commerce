export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AdminSettingsForm } from './AdminSettingsForm';

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data: me } = await admin.from('users').select('is_superadmin').eq('id', user.id).single();
  if (!(me as { is_superadmin: boolean } | null)?.is_superadmin) redirect('/dashboard');

  // Platform-wide plan limits (we show defaults that admins can adjust per workspace via Workspaces page)
  const PLAN_DEFAULTS = {
    free:  { minutes: 30,   concurrent: 1  },
    pro:   { minutes: 500,  concurrent: 5  },
    scale: { minutes: 5000, concurrent: 20 },
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-[#0a0a0a]">Global Settings</h1>
        <p className="text-sm text-[#6b6b6b] mt-0.5">Platform-wide defaults and operational controls</p>
      </div>

      {/* Plan defaults reference */}
      <Card className="bg-white border-[#e5e5e5]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Plan Defaults</CardTitle>
          <CardDescription className="text-xs">
            Default limits applied when a workspace is created or upgraded.
            Override per-workspace via the Workspaces page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(PLAN_DEFAULTS).map(([plan, limits]) => (
              <div key={plan} className="rounded-xl border border-[#e5e5e5] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#a0a0a0] mb-3">
                  {plan}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#6b6b6b]">Minutes / month</span>
                    <span className="font-semibold text-[#0a0a0a]">{limits.minutes.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6b6b6b]">Concurrent calls</span>
                    <span className="font-semibold text-[#0a0a0a]">{limits.concurrent}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Operational controls */}
      <AdminSettingsForm />
    </div>
  );
}
