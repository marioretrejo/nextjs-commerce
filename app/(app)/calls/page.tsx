'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { Call, CallOutcome, CallSentiment, CallDisposition } from '@/lib/supabase/types';
import { Phone, Search, Clock, User, Bot, ExternalLink, FileText } from 'lucide-react';
import { format } from 'date-fns';

type OutcomeFilter = 'all' | CallOutcome;
type DispositionFilter = 'all' | CallDisposition;

const DISPOSITION_CONFIG: Record<CallDisposition, { label: string; className: string }> = {
  meeting_booked:    { label: 'Meeting Booked',    className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  completed:         { label: 'Completed',          className: 'bg-blue-50 text-blue-700 border-blue-200' },
  follow_up:         { label: 'Follow Up',          className: 'bg-amber-50 text-amber-700 border-amber-200' },
  callback_requested:{ label: 'Callback',           className: 'bg-violet-50 text-violet-700 border-violet-200' },
  not_interested:    { label: 'Not Interested',     className: 'bg-red-50 text-red-700 border-red-200' },
  voicemail:         { label: 'Voicemail',          className: 'bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]' },
  transferred:       { label: 'Transferred',        className: 'bg-[#f5f5f5] text-[#0a0a0a] border-[#e0e0e0]' },
  other:             { label: 'Other',              className: 'bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]' },
};

function dispositionBadge(disposition: CallDisposition | null) {
  if (!disposition) return null;
  const cfg = DISPOSITION_CONFIG[disposition];
  return <Badge className={`${cfg.className} whitespace-nowrap text-xs`}>{cfg.label}</Badge>;
}

function sentimentBadge(sentiment: CallSentiment | null) {
  if (!sentiment) return null;
  const map: Record<CallSentiment, string> = {
    positive: 'border-transparent bg-emerald-50 text-emerald-700',
    neutral:  'border-[#e0e0e0] text-[#6b6b6b]',
    negative: 'border-transparent bg-red-50 text-red-700',
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
  const [dispositionFilter, setDispositionFilter] = useState<DispositionFilter>('all');
  const [workspaceId, setWorkspaceId] = useState('');

  useEffect(() => {
    fetch('/api/admin/workspace-id')
      .then((r) => r.json())
      .then((d: { workspace_id: string }) => setWorkspaceId(d.workspace_id ?? ''))
      .catch(() => setLoading(false));
  }, []);

  const fetchCalls = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const params = new URLSearchParams({ workspace_id: workspaceId, limit: '100' });
    if (outcomeFilter !== 'all') params.set('outcome', outcomeFilter);

    const res = await fetch(`/api/calls?${params.toString()}`);
    if (res.ok) {
      const data = await res.json() as { data: Call[] };
      let all = data.data ?? [];
      // Client-side filters
      const q = search.trim().toLowerCase();
      if (q) all = all.filter(c =>
        c.contact_name?.toLowerCase().includes(q) || c.contact_phone?.includes(q)
      );
      if (dispositionFilter !== 'all') all = all.filter(c => c.disposition === dispositionFilter);
      setCalls(all);
    }
    setLoading(false);
  }, [outcomeFilter, dispositionFilter, search, workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    const timer = setTimeout(fetchCalls, 300);
    return () => clearTimeout(timer);
  }, [fetchCalls, workspaceId]);

  const outcomes: { value: OutcomeFilter; label: string }[] = [
    { value: 'all',         label: 'All Outcomes' },
    { value: 'converted',   label: 'Converted' },
    { value: 'no_answer',   label: 'No Answer' },
    { value: 'voicemail',   label: 'Voicemail' },
    { value: 'rejected',    label: 'Rejected' },
    { value: 'transferred', label: 'Transferred' },
  ];

  const dispositions: { value: DispositionFilter; label: string }[] = [
    { value: 'all',              label: 'All Dispositions' },
    { value: 'meeting_booked',   label: 'Meeting Booked' },
    { value: 'completed',        label: 'Completed' },
    { value: 'follow_up',        label: 'Follow Up' },
    { value: 'callback_requested', label: 'Callback' },
    { value: 'not_interested',   label: 'Not Interested' },
    { value: 'voicemail',        label: 'Voicemail' },
    { value: 'transferred',      label: 'Transferred' },
    { value: 'other',            label: 'Other' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Calls</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            Browse call recordings, AI summaries, and dispositions.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
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
        <select
          value={dispositionFilter}
          onChange={(e) => setDispositionFilter(e.target.value as DispositionFilter)}
          className="h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
        >
          {dispositions.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>

      {/* Calls list */}
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
            <div className="divide-y divide-[#e0e0e0]">
              {calls.map((call) => (
                <div key={call.id} className="px-5 py-4 hover:bg-[#f5f5f5] transition-colors">
                  {/* Row 1: core fields */}
                  <div className="grid grid-cols-[1fr_1fr_1fr_80px_1fr_1fr_80px_1fr_40px] gap-3 text-sm items-center">
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
                    <span>{dispositionBadge(call.disposition)}</span>
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

                  {/* Row 2: AI summary preview (only if present) */}
                  {call.summary && (
                    <div className="mt-2 flex items-start gap-1.5 pl-5">
                      <FileText className="w-3.5 h-3.5 text-[#6b6b6b] mt-0.5 shrink-0" />
                      <p className="text-xs text-[#6b6b6b] line-clamp-2 leading-relaxed">
                        {call.summary.replace(/^•\s*/gm, '').split('\n').filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  )}
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
