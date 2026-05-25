'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface MinuteAlertsProps {
  workspaceId: string;
  initialUsed: number;
  limit: number;
  plan: string;
}

export function MinuteAlerts({ workspaceId, initialUsed, limit, plan }: MinuteAlertsProps) {
  const [minutesUsed, setMinutesUsed] = useState(initialUsed);
  const pct = limit > 0 ? Math.min((minutesUsed / limit) * 100, 100) : 0;
  const remaining = Math.max(0, limit - minutesUsed);

  // Real-time subscription to workspaces.minutes_used
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`workspace-minutes-${workspaceId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'workspaces', filter: `id=eq.${workspaceId}` },
        (payload) => {
          const updated = payload.new as { minutes_used?: number };
          if (updated.minutes_used !== undefined) {
            setMinutesUsed(Number(updated.minutes_used));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

  // 100% — non-dismissable modal (only dismiss via action)
  if (pct >= 100) {
    const resetDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
      .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#0a0a0a]">
            <span className="text-xl text-white">⛔</span>
          </div>
          <h2 className="mb-2 text-xl font-bold text-[#0a0a0a]">You&apos;ve reached your minute limit</h2>
          <p className="mb-6 text-sm text-[#6b6b6b]">
            Your plan includes <strong>{limit.toLocaleString()} minutes</strong> per month. You&apos;ve used them all.
            All outbound calls have been stopped.
            Your minutes reset on <strong>{resetDate}</strong>. Upgrade now to continue calling.
          </p>
          <div className="space-y-2">
            {plan === 'free' && (
              <Link href="/billing">
                <Button className="w-full">Upgrade to Pro — $97/mo</Button>
              </Link>
            )}
            {(plan === 'free' || plan === 'pro') && (
              <Link href="/billing">
                <Button variant="outline" className="w-full">Upgrade to Scale — $297/mo</Button>
              </Link>
            )}
            <Link href="/billing">
              <Button variant="ghost" className="w-full text-[#6b6b6b] text-sm">
                Wait for reset on {resetDate}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 90% — orange banner
  if (pct >= 90) {
    return (
      <div className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900 flex items-center justify-between">
        <span>
          <strong>⚠️ Only {remaining.toFixed(0)} minutes remaining.</strong>{' '}
          Your calls will stop at {limit.toLocaleString()} minutes.
        </span>
        <Link href="/billing">
          <Button size="sm" className="ml-4 shrink-0 bg-orange-600 hover:bg-orange-700 text-white border-transparent">
            Upgrade now
          </Button>
        </Link>
      </div>
    );
  }

  // 80% — yellow banner
  if (pct >= 80) {
    return (
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 flex items-center justify-between">
        <span>
          <strong>⚠️ You&apos;ve used {minutesUsed.toFixed(0)} of your {limit.toLocaleString()} minutes.</strong>{' '}
          {remaining.toFixed(0)} minutes remaining.
        </span>
        <Link href="/billing">
          <Button size="sm" variant="outline" className="ml-4 shrink-0 border-yellow-400 text-yellow-900 hover:bg-yellow-100">
            Upgrade plan
          </Button>
        </Link>
      </div>
    );
  }

  return null;
}
