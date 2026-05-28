'use client';

import { Building2 } from 'lucide-react';

interface Props {
  used: number;
  cap:  number;
}

export function EnterpriseQuotaBar({ used, cap }: Props) {
  const pct     = cap > 0 ? Math.min(Math.round((used / cap) * 100), 100) : 0;
  const remaining = Math.max(cap - used, 0);

  const barColor =
    pct >= 90 ? 'bg-red-500' :
    pct >= 75 ? 'bg-amber-500' :
    'bg-[#0a0a0a]';

  return (
    <div className="w-full border-b border-[#e5e5e5] bg-white px-6 py-3 flex items-center gap-4">
      <div className="flex items-center gap-2 shrink-0">
        <Building2 className="h-4 w-4 text-[#6b6b6b]" />
        <span className="text-xs font-semibold text-[#0a0a0a]">Enterprise Contract</span>
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between text-xs text-[#6b6b6b]">
          <span>Contract Minutes</span>
          <span>
            <span className="font-semibold text-[#0a0a0a]">{used.toLocaleString()}</span>
            {' / '}
            {cap.toLocaleString()} used
            {' · '}
            <span className={pct >= 90 ? 'text-red-600 font-semibold' : ''}>
              {remaining.toLocaleString()} remaining
            </span>
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-[#f0f0f0] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className={`text-xs font-bold shrink-0 ${pct >= 90 ? 'text-red-600' : 'text-[#6b6b6b]'}`}>
        {pct}%
      </span>
    </div>
  );
}
