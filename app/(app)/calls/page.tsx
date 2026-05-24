'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { Call, CallOutcome, CallSentiment } from '@/lib/supabase/types';
import { Phone, Search, Clock, User, Bot, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

type OutcomeFilter = 'all' | CallOutcome;

function outcomeBadge(outcome: CallOutcome | null) {
  if (!outcome) return <Badge variant="outline">Unknown</Badge>;
  const map: Record<CallOutcome, { label: string; className: string }> = {
    converted:   { label: 'Converted',   className: 'bg-[#0a0a0a] text-white border-transparent' },
    no_answer:   { label: 'No Answer',   className: 'bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]' },
    voicemail:   { label: 'Voicemail',   className: 'bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]' },
    rejected:    { label: 'Rejected',    className: 'bg-[#f5f5f5] text-[#0a0a0a] border-[#e0e0e0]' },
    transferred: { label: 'Transferred', className: 'bg-[#f5f5f5] text-[#0a0a0a] border-[#e0e0e0]' },
  };
  const s = map[outcome];
  return <Badge className={s.className}>{s.label}</Badge>;
}

function sentimentBadge(sentiment: CallSentiment | null) {
  if (!sentiment) return null;
  const map: Record<CallSentiment, string> = {
    positive: 'border-transparent bg-[#f5f5f5] text-[#0a0a0a]',
    neutral:  'border-[#e0e0e0] text-[#6b6b6b]',
    negative: 'border-transparent bg-[#0a0a0a] text-white',
  };
  return (
    <Badge className={map[sentiment]}>
      {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
    </Badge>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (outcomeFilter !== 'all') params.set('outcome', outcomeFilter);
    if (search.trim()) params.set('search', search.trim());
    params.set('limit', '100');

    const res = await fetch(`/api/calls?${params.toString()}`);
    if (res.ok) {
      const data = await res.json() as { calls: Call[] };
      setCalls(data.calls ?? []);
    }
    setLoading(false);
  }, [outcomeFilter, search]);

  useEffect(() => {
    const timer = setTimeout(fetchCalls, 300);
    return () => clearTimeout(timer);
  }, [fetchCalls]);

  const outcomes: { value: OutcomeFilter; label: string }[] = [
    { value: 'all',         label: 'All Outcomes' },
    { value: 'converted',   label: 'Converted' },
    { value: 'no_answer',   label: 'No Answer' },
    { value: 'voicemail',   label: 'Voicemail' },
    { value: 'rejected',    label: 'Rejected' },
    { value: 'transferred', label: 'Transferred' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Calls</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            Browse and filter all call recordings and outcomes.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
          <Input
            placeholder="Search contact name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value as OutcomeFilter)}
          className="h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
        >
          {outcomes.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <CardContent className="p-0">
            <div className="divide-y divide-[#e0e0e0]">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-32 h-4 bg-[#f5f5f5] rounded animate-pulse" />
                  <div className="w-28 h-4 bg-[#f5f5f5] rounded animate-pulse" />
                  <div className="w-24 h-4 bg-[#f5f5f5] rounded animate-pulse ml-auto" />
                </div>
              ))}
            </div>
          </CardContent>
        ) : calls.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Phone className="w-12 h-12 text-[#e0e0e0] mb-4" />
            <p className="text-[#0a0a0a] font-medium mb-1">No calls found</p>
            <p className="text-sm text-[#6b6b6b]">Try adjusting your filters.</p>
          </CardContent>
        ) : (
          <CardContent className="p-0">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1fr_1fr_80px_1fr_1fr_80px_1fr_40px] gap-3 px-5 py-3 border-b border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
              <span>Contact</span>
              <span>Phone</span>
              <span>Agent</span>
              <span>Duration</span>
              <span>Outcome</span>
              <span>Sentiment</span>
              <span>QA</span>
              <span>Date</span>
              <span />
            </div>
            <div className="divide-y divide-[#e0e0e0]">
              {calls.map((call) => (
                <div
                  key={call.id}
                  className="grid grid-cols-[1fr_1fr_1fr_80px_1fr_1fr_80px_1fr_40px] gap-3 px-5 py-4 text-sm items-center hover:bg-[#f5f5f5] transition-colors"
                >
                  <span className="font-medium text-[#0a0a0a] truncate flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#6b6b6b] shrink-0" />
                    {call.contact_name ?? '—'}
                  </span>
                  <span className="text-[#6b6b6b] flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    {call.contact_phone ?? '—'}
                  </span>
                  <span className="text-[#6b6b6b] flex items-center gap-1.5 truncate">
                    <Bot className="w-3.5 h-3.5 shrink-0" />
                    {call.agent ? (call.agent as unknown as { name: string }).name : '—'}
                  </span>
                  <span className="text-[#6b6b6b] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    {formatDuration(call.duration_seconds)}
                  </span>
                  <span>{outcomeBadge(call.outcome)}</span>
                  <span>{sentimentBadge(call.sentiment)}</span>
                  <span className="text-[#0a0a0a] font-medium">
                    {call.qa_score != null ? `${call.qa_score}%` : '—'}
                  </span>
                  <span className="text-[#6b6b6b] text-xs">
                    {format(new Date(call.created_at), 'MMM d, yyyy HH:mm')}
                  </span>
                  <Link href={`/calls/${call.id}`} className="flex items-center justify-center">
                    <ExternalLink className="w-4 h-4 text-[#6b6b6b] hover:text-[#0a0a0a]" />
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {!loading && calls.length > 0 && (
        <p className="mt-3 text-xs text-[#6b6b6b] text-right">{calls.length} calls shown</p>
      )}
    </div>
  );
}
