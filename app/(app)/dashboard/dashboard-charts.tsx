'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

interface CallData { date: string; calls: number }
interface OutcomeData { name: string; value: number }

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

      const outcomes: Record<string, number> = {};
      data.forEach((c) => {
        const key = c.outcome ?? 'unknown';
        outcomes[key] = (outcomes[key] ?? 0) + 1;
      });
      setPieData(Object.entries(outcomes).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
        value,
      })));

      setLoading(false);
    }
    load();
  }, [workspaceId]);

  const PIE_COLORS = ['#0a0a0a', '#6b6b6b', '#c0c0c0', '#d0d0d0', '#e0e0e0'];

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

  const maxCalls = Math.max(...barData.map((d) => d.calls), 1);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* 7-day bar chart — pure CSS */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Calls — Last 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          {barData.length === 0 || maxCalls === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-[#6b6b6b]">No call data yet</div>
          ) : (
            <div className="flex h-48 items-end gap-2">
              {barData.map(({ date, calls }) => (
                <div key={date} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs text-[#6b6b6b]">{calls > 0 ? calls : ''}</span>
                  <div
                    className="w-full rounded-t-sm bg-[#0a0a0a] transition-all"
                    style={{ height: `${Math.round((calls / maxCalls) * 160)}px`, minHeight: calls > 0 ? '4px' : '0' }}
                  />
                  <span className="text-[10px] text-[#6b6b6b]">{date}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outcomes — pure CSS */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Call Outcomes</CardTitle>
        </CardHeader>
        <CardContent>
          {pieData.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-[#6b6b6b]">No call data yet</div>
          ) : (
            <div className="space-y-2.5">
              {(() => {
                const total = pieData.reduce((s, d) => s + d.value, 0);
                return pieData.map((entry, i) => (
                  <div key={entry.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="text-[#6b6b6b]">{entry.name}</span>
                      </div>
                      <span className="font-medium">{entry.value} ({Math.round((entry.value / total) * 100)}%)</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#f0f0f0]">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${Math.round((entry.value / total) * 100)}%`,
                          backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
