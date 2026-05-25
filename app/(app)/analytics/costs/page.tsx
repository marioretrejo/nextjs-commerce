'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart2, Clock, TrendingUp, DollarSign } from 'lucide-react';
import Link from 'next/link';

interface UsageData {
  minutes_used: number;
  minutes_limit: number;
  plan: string;
  overage_minutes: number;
  next_billing_date: string | null;
  last_reset_at: string | null;
}

const PLAN_PRICES: Record<string, number> = { free: 0, pro: 97, scale: 297 };
const OVERAGE_RATES: Record<string, number> = { free: 0, pro: 0.15, scale: 0.10 };

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/workspace/usage')
      .then(r => r.ok ? r.json() as Promise<UsageData> : Promise.resolve(null))
      .then(d => { setUsage(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const pct = usage ? Math.min((usage.minutes_used / usage.minutes_limit) * 100, 100) : 0;
  const planPrice = usage ? (PLAN_PRICES[usage.plan] ?? 0) : 0;
  const overageRate = usage ? (OVERAGE_RATES[usage.plan] ?? 0) : 0;
  const overageCharge = usage ? usage.overage_minutes * overageRate : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Usage</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">Your minute consumption and plan billing summary.</p>
          <div className="flex gap-2 mt-2">
            <Link href="/analytics" className="inline-flex items-center gap-1 rounded-md border border-[#e0e0e0] px-3 py-1 text-xs font-medium text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors">
              <BarChart2 className="h-3 w-3" /> Performance
            </Link>
            <span className="inline-flex items-center rounded-md border border-[#0a0a0a] bg-[#0a0a0a] text-white px-3 py-1 text-xs font-medium">Usage</span>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-[#6b6b6b]">Minutes Used</p>
              <Clock className="w-5 h-5 text-[#6b6b6b]" />
            </div>
            {loading ? <div className="h-8 w-24 bg-[#f5f5f5] rounded animate-pulse" /> : (
              <p className="text-3xl font-bold text-[#0a0a0a]">
                {(usage?.minutes_used ?? 0).toFixed(0)}
                <span className="text-base font-normal text-[#6b6b6b] ml-1">/ {usage?.minutes_limit ?? 0} min</span>
              </p>
            )}
            <p className="text-xs text-[#6b6b6b] mt-1">This billing period</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-[#6b6b6b]">Plan Charge</p>
              <DollarSign className="w-5 h-5 text-[#6b6b6b]" />
            </div>
            {loading ? <div className="h-8 w-24 bg-[#f5f5f5] rounded animate-pulse" /> : (
              <p className="text-3xl font-bold text-[#0a0a0a]">
                ${planPrice}
                <span className="text-base font-normal text-[#6b6b6b] ml-1">/mo</span>
              </p>
            )}
            <p className="text-xs text-[#6b6b6b] mt-1 capitalize">{usage?.plan ?? '—'} plan</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-[#6b6b6b]">Overage Charge</p>
              <TrendingUp className="w-5 h-5 text-[#6b6b6b]" />
            </div>
            {loading ? <div className="h-8 w-24 bg-[#f5f5f5] rounded animate-pulse" /> : (
              <p className="text-3xl font-bold text-[#0a0a0a]">${overageCharge.toFixed(2)}</p>
            )}
            <p className="text-xs text-[#6b6b6b] mt-1">
              {usage && usage.overage_minutes > 0
                ? `${usage.overage_minutes} overage min × $${overageRate.toFixed(2)}`
                : 'No overage this period'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage bar */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Minute Usage</CardTitle>
          <CardDescription>
            {loading ? 'Loading…' : `${(usage?.minutes_used ?? 0).toFixed(0)} of ${usage?.minutes_limit ?? 0} minutes used`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-4 bg-[#f5f5f5] rounded animate-pulse" />
          ) : (
            <>
              <Progress
                value={pct}
                className={
                  pct >= 100 ? '[&>div]:bg-[#0a0a0a]'
                  : pct >= 90 ? '[&>div]:bg-[#3a3a3a]'
                  : pct >= 80 ? '[&>div]:bg-[#6b6b6b]'
                  : ''
                }
              />
              <div className="flex justify-between mt-2 text-xs text-[#6b6b6b]">
                <span>{pct.toFixed(1)}% used</span>
                <span>{Math.max(0, (usage?.minutes_limit ?? 0) - (usage?.minutes_used ?? 0)).toFixed(0)} min remaining</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Billing summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Billing Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-5 bg-[#f5f5f5] rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[#6b6b6b]">Plan</span>
                <span className="font-medium capitalize">{usage?.plan ?? '—'} — ${planPrice}/mo</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6b6b6b]">Included minutes</span>
                <span className="font-medium">{(usage?.minutes_limit ?? 0).toLocaleString()} min/mo</span>
              </div>
              {(usage?.overage_minutes ?? 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#6b6b6b]">Overage ({usage!.overage_minutes} min)</span>
                  <span className="font-medium">${overageCharge.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-[#e0e0e0] pt-3 flex justify-between text-sm font-semibold">
                <span>Estimated total</span>
                <span>${(planPrice + overageCharge).toFixed(2)}</span>
              </div>
              {usage?.next_billing_date && (
                <p className="text-xs text-[#6b6b6b]">Next billing date: {new Date(usage.next_billing_date).toLocaleDateString()}</p>
              )}
              {usage?.last_reset_at && (
                <p className="text-xs text-[#6b6b6b]">Last reset: {new Date(usage.last_reset_at).toLocaleDateString()}</p>
              )}
              <div className="pt-2">
                <Link href="/billing" className="text-xs text-[#0a0a0a] underline underline-offset-2">Manage plan & billing →</Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
