export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { AlertTriangle, DollarSign, TrendingUp } from 'lucide-react';

interface WorkspaceEvent {
  id: string;
  workspace_id: string;
  event_type: string;
  details: Record<string, unknown>;
  created_at: string;
  workspace?: { name: string } | null;
}

export default async function AdminBillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data: me } = await admin.from('users').select('is_superadmin').eq('id', user.id).single();
  if (!(me as { is_superadmin: boolean } | null)?.is_superadmin) redirect('/dashboard');

  // Limit breach events
  const { data: limitEvents } = await admin
    .from('workspace_events')
    .select('id, workspace_id, event_type, details, created_at')
    .eq('event_type', 'limit_reached')
    .order('created_at', { ascending: false })
    .limit(50);

  // Workspace names for limit events
  const wsIds = [...new Set((limitEvents ?? []).map((e) => (e as { workspace_id: string }).workspace_id))];
  const { data: wsNames } = wsIds.length
    ? await admin.from('workspaces').select('id, name').in('id', wsIds)
    : { data: [] };
  const wsNameMap = Object.fromEntries((wsNames ?? []).map((w) => [w.id, w.name]));

  // Recent calls with cost
  const { data: recentCalls } = await admin
    .from('calls')
    .select('id, workspace_id, agent_id, duration_seconds, status, cost_usd, created_at')
    .order('created_at', { ascending: false })
    .limit(30);

  // Platform-wide totals this month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: monthCalls } = await admin
    .from('calls')
    .select('duration_seconds, cost_usd')
    .gte('created_at', monthStart.toISOString());

  const monthMinutes = Math.round((monthCalls ?? []).reduce((s, c) => s + (c.duration_seconds ?? 0), 0) / 60);
  const monthCost = (monthCalls ?? []).reduce((s, c) => s + Number(c.cost_usd ?? 0), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-[#0a0a0a]">Billing Audits</h1>
        <p className="text-sm text-[#6b6b6b] mt-0.5">Limit breaches, call costs, and usage anomalies</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Limit Breaches (all time)',
            value: (limitEvents ?? []).length,
            icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
            sub: 'workspaces that hit their minute cap',
          },
          {
            label: 'Minutes This Month',
            value: monthMinutes.toLocaleString(),
            icon: <TrendingUp className="w-5 h-5 text-[#6b6b6b]" />,
            sub: `${(monthCalls ?? []).length} calls`,
          },
          {
            label: 'API Cost This Month',
            value: `$${monthCost.toFixed(2)}`,
            icon: <DollarSign className="w-5 h-5 text-[#6b6b6b]" />,
            sub: 'aggregated provider cost',
          },
        ].map((m) => (
          <Card key={m.label} className="bg-white border-[#e5e5e5]">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm text-[#6b6b6b]">{m.label}</p>
                {m.icon}
              </div>
              <p className="text-3xl font-bold text-[#0a0a0a]">{m.value}</p>
              <p className="text-xs text-[#6b6b6b] mt-1">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Limit breach events */}
        <Card className="bg-white border-[#e5e5e5]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Limit Breach Events
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(limitEvents ?? []).length === 0 ? (
              <p className="px-5 py-8 text-sm text-[#a0a0a0] text-center">No limit breaches recorded.</p>
            ) : (
              <div className="divide-y divide-[#f0f0f0]">
                {(limitEvents ?? []).map((ev) => {
                  const e = ev as WorkspaceEvent;
                  const d = e.details as { new_minutes_used?: number; minutes_limit?: number; duration_minutes?: number };
                  return (
                    <div key={e.id} className="px-5 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[#0a0a0a]">
                          {wsNameMap[e.workspace_id] ?? e.workspace_id.slice(0, 8)}
                        </span>
                        <span className="text-xs text-[#a0a0a0]">
                          {format(new Date(e.created_at), 'MMM d, HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs text-[#6b6b6b]">
                        Used {d.new_minutes_used?.toFixed(1)} / {d.minutes_limit} min
                        {d.duration_minutes ? ` · +${d.duration_minutes.toFixed(1)} min call` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent calls */}
        <Card className="bg-white border-[#e5e5e5]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Calls</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-[1fr_60px_60px] gap-3 px-5 py-3 border-t border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
              <span>Workspace</span><span>Min</span><span>Status</span>
            </div>
            <div className="divide-y divide-[#f0f0f0]">
              {(recentCalls ?? []).map((c) => {
                const call = c as { id: string; workspace_id: string; duration_seconds: number; status: string; created_at: string };
                return (
                  <div key={call.id} className="grid grid-cols-[1fr_60px_60px] gap-3 px-5 py-2.5 text-sm items-center hover:bg-[#f9f9f9]">
                    <div>
                      <p className="text-xs font-mono text-[#6b6b6b] truncate">{call.workspace_id.slice(0, 8)}…</p>
                      <p className="text-[11px] text-[#a0a0a0]">{format(new Date(call.created_at), 'MMM d, HH:mm')}</p>
                    </div>
                    <span className="text-xs text-[#0a0a0a]">
                      {(call.duration_seconds / 60).toFixed(1)}
                    </span>
                    <Badge
                      variant={call.status === 'completed' ? 'secondary' : 'destructive'}
                      className="text-[10px] justify-center"
                    >
                      {call.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
