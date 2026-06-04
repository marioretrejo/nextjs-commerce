import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, DollarSign, BarChart2, Megaphone, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default async function MarketingFinancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('is_superadmin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_superadmin) redirect('/dashboard');

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] mb-1">Admin</p>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111] shrink-0">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]" style={{ letterSpacing: '-0.02em' }}>
              Marketing Finance
            </h1>
            <p className="text-xs text-[#b0b0b0] mt-0.5">Budget tracking, campaign ROI and spend analysis</p>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Budget',       value: '$0',   sub: 'allocated this month',  icon: DollarSign,  trend: null },
          { label: 'Total Spend',        value: '$0',   sub: 'spent to date',          icon: BarChart2,   trend: null },
          { label: 'Active Campaigns',   value: '0',    sub: 'running now',            icon: Megaphone,   trend: null },
          { label: 'Avg. Cost per Call', value: '—',    sub: 'across all campaigns',   icon: Target,      trend: null },
        ].map(({ label, value, sub, icon: Icon }) => (
          <Card key={label} className="relative overflow-hidden group">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e0e0e0] to-transparent" />
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">{label}</p>
                <Icon className="h-3.5 w-3.5 text-[#d0d0d0]" />
              </div>
              <div className="text-2xl font-bold text-[#0a0a0a] mb-1.5">{value}</div>
              <div className="flex items-center gap-1.5">
                <div className="h-px flex-1 bg-[#f0f0f0]" />
                <p className="text-[10px] text-[#c0c0c0] font-medium shrink-0">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Budget breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Budget Breakdown by Channel</CardTitle>
            <CardDescription>Allocation vs. actual spend per marketing channel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { channel: 'Outbound Calls',  budget: 0, spend: 0, color: 'bg-blue-500' },
                { channel: 'SMS Campaigns',   budget: 0, spend: 0, color: 'bg-purple-500' },
                { channel: 'Email',           budget: 0, spend: 0, color: 'bg-green-500' },
                { channel: 'Paid Ads',        budget: 0, spend: 0, color: 'bg-orange-500' },
              ].map(({ channel, color }) => (
                <div key={channel}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${color}`} />
                      <span className="text-sm font-medium text-[#333]">{channel}</span>
                    </div>
                    <span className="text-xs text-[#9b9b9b]">$0 / $0</span>
                  </div>
                  <div className="h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color} opacity-40`} style={{ width: '0%' }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-dashed border-[#e0e0e0] py-8 text-center">
              <BarChart2 className="h-8 w-8 text-[#e0e0e0] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#555]">No spend data yet</p>
              <p className="text-xs text-[#9b9b9b] mt-1">Budget and spend data will appear here once campaigns are active.</p>
            </div>
          </CardContent>
        </Card>

        {/* Top campaigns */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Campaigns by ROI</CardTitle>
            <CardDescription>Best performing this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="py-10 text-center">
              <Target className="h-8 w-8 text-[#e0e0e0] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#555]">No campaigns yet</p>
              <p className="text-xs text-[#9b9b9b] mt-1">Create campaigns to see ROI rankings.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Spend trend */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Monthly Spend Trend</CardTitle>
              <CardDescription>Marketing expenditure over the last 6 months</CardDescription>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-[#f5f5f5] px-2.5 py-1.5">
              <ArrowUpRight className="h-3 w-3 text-[#9b9b9b]" />
              <span className="text-[10px] font-semibold text-[#9b9b9b]">No data</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-end gap-2">
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map(month => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full bg-[#f0f0f0] rounded-t-md" style={{ height: '4px' }} />
                <span className="text-[9px] text-[#c0c0c0] font-medium">{month}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
