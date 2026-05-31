import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/server';
import { getUserWorkspaces } from '@/lib/workspace';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { DashboardCharts } from './dashboard-charts';
import { LiveCallsCounter } from './live-calls-counter';
import { CircularRing } from '@/components/minute-usage/circular-ring';

export default async function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] mb-1">Overview</p>
        <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]" style={{ letterSpacing: '-0.02em' }}>Dashboard</h1>
        <p className="text-xs text-[#b0b0b0] mt-0.5">Voice operations at a glance</p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?callbackUrl=/dashboard');

  const workspaces = await getUserWorkspaces();
  const workspace = workspaces[0];
  if (!workspace) redirect('/onboarding');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    { count: totalAgents,  error: agentsErr },
    { count: activeAgents, error: activeErr },
    { count: callsToday,   error: todayErr },
    { data: recentCalls,   error: recentErr },
    { data: campaigns,     error: campaignsErr }
  ] = await Promise.all([
    supabase.from('agents').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
    supabase.from('agents').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id).eq('status', 'active'),
    supabase.from('calls').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id).gte('created_at', today.toISOString()),
    supabase.from('calls').select('id, duration_seconds, outcome, sentiment, created_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(100),
    supabase.from('campaigns').select('id, status').eq('workspace_id', workspace.id)
  ]);

  const dashErr = agentsErr ?? activeErr ?? todayErr ?? recentErr ?? campaignsErr;
  if (dashErr) console.error('dashboard: query error', dashErr.message);

  const totalCalls = recentCalls?.length ?? 0;
  const converted = recentCalls?.filter((c) => c.outcome === 'converted').length ?? 0;
  const conversionRate = totalCalls > 0 ? Math.round((converted / totalCalls) * 100) : 0;
  const avgDuration = totalCalls > 0
    ? Math.round((recentCalls?.reduce((s, c) => s + (c.duration_seconds ?? 0), 0) ?? 0) / totalCalls)
    : 0;
  const activeCampaigns = campaigns?.filter((c) => c.status === 'active').length ?? 0;

  return (
    <>
      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard title="Active Agents" value={String(activeAgents ?? 0)} sub={`of ${totalAgents ?? 0} total`} />
        <LiveCallsCounter workspaceId={workspace.id} />
        <MetricCard title="Calls Today" value={String(callsToday ?? 0)} sub="since midnight" />
        <MetricCard title="Conversion Rate" value={`${conversionRate}%`} sub={`${converted} converted`} />
      </div>

      {/* Minutes + campaigns row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#6b6b6b]">Minutes Usage</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-4">
            <CircularRing
              workspaceId={workspace.id}
              initialUsed={Number(workspace.minutes_used)}
              limit={Number(workspace.minutes_limit)}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <MetricCard title="Active Campaigns" value={String(activeCampaigns)} sub="running now" />
          <MetricCard
            title="Avg. Call Duration"
            value={avgDuration > 0 ? `${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s` : '—'}
            sub="last 100 calls"
          />
        </div>
      </div>

      {/* Charts */}
      <DashboardCharts workspaceId={workspace.id} />
    </>
  );
}

function MetricCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <Card className="relative overflow-hidden group">
      {/* Top accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e0e0e0] to-transparent" />
      <CardContent className="p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] mb-3">{title}</p>
        <div className="metric-value mb-1.5">{value}</div>
        <div className="flex items-center gap-1.5">
          <div className="h-px flex-1 bg-[#f0f0f0]" />
          <p className="text-[10px] text-[#c0c0c0] font-medium shrink-0">{sub}</p>
        </div>
      </CardContent>
      {/* Bottom hover glow */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#0a0a0a]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
