'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

interface CallData {
  date: string;
  calls: number;
}

interface OutcomeData {
  name: string;
  value: number;
}

export function DashboardCharts({ workspaceId }: { workspaceId: string }) {
  const [barData, setBarData] = useState<CallData[]>([]);
  const [pieData, setPieData] = useState<OutcomeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const { data } = await supabase
        .from('calls')
        .select('created_at, outcome')
        .eq('workspace_id', workspaceId)
        .gte('created_at', since.toISOString());

      if (!data) { setLoading(false); return; }

      // Bar chart: calls per day
      const byDay: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        byDay[d.toLocaleDateString('en-US', { weekday: 'short' })] = 0;
      }
      data.forEach((c) => {
        const label = new Date(c.created_at).toLocaleDateString('en-US', { weekday: 'short' });
        if (label in byDay) byDay[label] = (byDay[label] ?? 0) + 1;
      });
      setBarData(Object.entries(byDay).map(([date, calls]) => ({ date, calls })));

      // Pie chart: outcomes
      const outcomes: Record<string, number> = {};
      data.forEach((c) => {
        const key = c.outcome ?? 'unknown';
        outcomes[key] = (outcomes[key] ?? 0) + 1;
      });
      setPieData(
        Object.entries(outcomes).map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
          value
        }))
      );

      setLoading(false);
    }
    load();
  }, [workspaceId]);

  const PIE_COLORS = ['#0a0a0a', '#6b6b6b', '#c0c0c0', '#e0e0e0', '#f5f5f5'];

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardContent className="flex h-64 items-center justify-center">
              <span className="text-sm text-[#6b6b6b]">Loading…</span>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* 7-day bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Calls — Last 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barSize={24}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b6b6b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6b6b6b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '12px' }}
                cursor={{ fill: '#f5f5f5' }}
              />
              <Bar dataKey="calls" fill="#0a0a0a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Outcomes donut */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Call Outcomes</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5">
                {pieData.map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-[#6b6b6b]">{entry.name}</span>
                    <span className="ml-auto font-medium">{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-32 w-full items-center justify-center">
              <p className="text-sm text-[#6b6b6b]">No call data yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
