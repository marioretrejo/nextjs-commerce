'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface MinutePillProps {
  workspaceId: string;
  initialUsed: number;
  limit: number;
}

export function MinutePill({ workspaceId, initialUsed, limit }: MinutePillProps) {
  const [minutesUsed, setMinutesUsed] = useState(initialUsed);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`pill-minutes-${workspaceId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'workspaces', filter: `id=eq.${workspaceId}` },
        (payload) => {
          const updated = payload.new as { minutes_used?: number };
          if (updated.minutes_used !== undefined) setMinutesUsed(Number(updated.minutes_used));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

  const remaining = Math.max(0, limit - minutesUsed);
  const pct = limit > 0 ? (minutesUsed / limit) * 100 : 0;

  const pillClass =
    pct >= 100 ? 'bg-[#0a0a0a] text-white'
    : pct >= 90 ? 'bg-[#3a3a3a] text-white'
    : pct >= 80 ? 'bg-[#f5f5f5] text-[#6b6b6b] border border-[#e0e0e0]'
    : 'bg-[#f5f5f5] text-[#6b6b6b] border border-[#e0e0e0]';

  return (
    <Link href="/analytics/costs">
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${pillClass}`}>
        {remaining.toFixed(0)} min left
      </span>
    </Link>
  );
}
