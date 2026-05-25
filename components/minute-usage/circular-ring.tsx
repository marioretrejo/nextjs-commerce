'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CircularRingProps {
  workspaceId: string;
  initialUsed: number;
  limit: number;
}

export function CircularRing({ workspaceId, initialUsed, limit }: CircularRingProps) {
  const [minutesUsed, setMinutesUsed] = useState(initialUsed);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`ring-minutes-${workspaceId}`)
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

  const pct     = limit > 0 ? Math.min((minutesUsed / limit) * 100, 100) : 0;
  const remaining = Math.max(0, limit - minutesUsed);

  const radius    = 54;
  const circ      = 2 * Math.PI * radius;
  const dashOffset = circ - (pct / 100) * circ;

  const color =
    pct >= 100 ? '#0a0a0a'
    : pct >= 90 ? '#3a3a3a'
    : pct >= 80 ? '#6b6b6b'
    : '#0a0a0a';

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width={128} height={128} className="-rotate-90">
          <circle cx={64} cy={64} r={radius} fill="none" stroke="#e0e0e0" strokeWidth={10} />
          <circle
            cx={64} cy={64} r={radius}
            fill="none" stroke={color} strokeWidth={10}
            strokeDasharray={circ} strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <span className="text-xl font-bold text-[#0a0a0a] leading-none">{remaining.toFixed(0)}</span>
          <span className="text-xs text-[#6b6b6b]">min left</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-[#6b6b6b]">
        {minutesUsed.toFixed(0)} / {limit.toLocaleString()} min used
      </p>
    </div>
  );
}
