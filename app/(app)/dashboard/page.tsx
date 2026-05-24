import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/server';
import { getUserWorkspaces } from '@/lib/workspace';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { DashboardCharts } from './dashboard-charts';
import { LiveCallsCounter } from './live-calls-counter';

export default async function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-[#6b6b6b]">Overview of your voice operations</p>
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
  if (!user) redirect('/login');

  const workspaces = await getUserWorkspaces();
  const workspace = workspaces[0];
  if (!workspace) redirect('/login');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    { count: totalAgents },
    { count: activeAgents },
    { count: callsToday },
    { data: recentCalls },
    { data: campaigns }
  ] = await Promise.all([
    supabase.from('agents').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
    supabase.from('agents').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id).eq('status', 'active'),
    supabase.from('calls').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id).gte('created_at', today.toISOString()),
    supabase.from('calls').select('id, duration_seconds, outcome, sentiment, created_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(100),
    supabase.from('campaigns').select('id, status').eq('workspace_id', workspace.id)
  ]);

  const totalCalls = recentCalls?.length ?? 0;
  const converted = recentCalls?.filter((c) => c.outcome === 'converted').length ?? 0;
  const conversionRate = totalCalls > 0 ? Math.round((converted / totalCalls) * 100) : 0;
  const avgDuration = totalCalls > 0
    ? Math.round((recentCalls?.reduce((s, c) => s + (c.duration_seconds ?? 0), 0) ?? 0) / totalCalls)
    : 0;
  const minutesPct = Math.min((workspace.minutes_used / workspace.minutes_limit) * 100, 100);
  const activeCampaigns = campaigns?.filter((c) => c.status === 'active').length ?? 0;

  return (
    <>
      {/* Alert banners */}
      {minutesPct >= 100 && (
        <div className="rounded-lg border border-[#0a0a0a] bg-[#0a0a0a] px-4 py-3 text-sm text-white">
          <strong>Minutes limit reached.</strong> All calls are paused.{' '}
          <a href="/billing" className="underline">Upgrade your plan</a> to resume.
        </div>
      )}
      {minutesPct >= 80 && minutesPct < 100 && (
        <div className="rounded-lg border border-[#e0e0e0] bg-[#f5f5f5] px-4 py-3 text-sm text-[#0a0a0a]">
          <strong>80% of minutes used.</strong> You have {workspace.minutes_limit - workspace.minutes_used} minutes remaining.{' '}
          <a href="/billing" className="underline">Upgrade to avoid interruption.</a>
        </div>
      )}

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
            <CardTitle className="text-sm font-medium text-[#6b6b6b]">Minutes Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{workspace.minutes_used.toLocaleString()}</span>
              <span className="text-sm text-[#6b6b6b]">/ {workspace.minutes_limit.toLocaleString()} min</span>
            </div>
            <Progress value={minutesPct} />
            <p className="mt-1 text-xs text-[#6b6b6b]">{minutesPct.toFixed(1)}% of monthly limit</p>
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[#6b6b6b]">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-[#6b6b6b]">{sub}</p>
      </CardContent>
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
