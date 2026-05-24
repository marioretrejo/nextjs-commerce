'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export function LiveCallsCounter({ workspaceId }: { workspaceId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    async function fetchLive() {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('calls')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'in_progress')
        .gte('created_at', fiveMinAgo);
      setCount(count ?? 0);
    }

    fetchLive();
    const interval = setInterval(fetchLive, 5000);

    // Realtime subscription
    const channel = supabase
      .channel(`live-calls-${workspaceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'calls',
        filter: `workspace_id=eq.${workspaceId}`
      }, () => fetchLive())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#6b6b6b]">
          Live Calls
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0a0a0a] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0a0a0a]" />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{count}</div>
        <p className="text-xs text-[#6b6b6b]">active right now</p>
      </CardContent>
    </Card>
  );
}
