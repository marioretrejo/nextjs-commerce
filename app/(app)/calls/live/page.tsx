'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { Phone, Radio } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface LiveCall {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  created_at: string;
  transcript: string | null;
  sentiment: string | null;
  agent?: { name: string } | null;
  agent_id: string | null;
  workspace_id: string;
}

function ElapsedTimer({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(since).getTime();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [since]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return <span className="font-mono text-xs text-[#6b6b6b]">{m}:{String(s).padStart(2, '0')}</span>;
}

function sentimentColor(sentiment: string | null) {
  if (sentiment === 'positive') return 'text-green-600';
  if (sentiment === 'negative') return 'text-red-500';
  return 'text-[#6b6b6b]';
}

export default function LiveMonitorPage() {
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState('');
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/admin/workspace-id')
      .then(r => r.json())
      .then((d: { workspace_id: string }) => setWorkspaceId(d.workspace_id ?? ''));
  }, []);

  useEffect(() => {
    fetch('/api/calls/live')
      .then(r => r.json())
      .then((d: { calls: LiveCall[] }) => {
        setCalls(d.calls ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createClient();
    const channel = supabase.channel('live-calls')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'calls',
        filter: `workspace_id=eq.${workspaceId}`
      }, async () => {
        const res = await fetch('/api/calls/live');
        if (res.ok) {
          const d = await res.json() as { calls: LiveCall[] };
          setCalls(d.calls ?? []);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [selectedId, calls]);

  const selected = calls.find(c => c.id === selectedId) ?? calls[0] ?? null;

  function parseTranscript(raw: string | null): { role: string; text: string }[] {
    if (!raw) return [];
    return raw.split('\n').filter(Boolean).map(line => {
      if (line.startsWith('Agent:')) return { role: 'agent', text: line.slice(6).trim() };
      if (line.startsWith('User:')) return { role: 'user', text: line.slice(5).trim() };
      return { role: 'system', text: line.trim() };
    });
  }

  const transcriptLines = parseTranscript(selected?.transcript ?? null);
  const lastLine = transcriptLines[transcriptLines.length - 1];
  const speakingLabel = lastLine?.role === 'agent' ? 'Agent speaking' : lastLine?.role === 'user' ? 'User speaking' : 'Listening';

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Left: active call list */}
      <div className="w-72 border-r border-[#e0e0e0] flex flex-col">
        <div className="p-4 border-b border-[#e0e0e0]">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-green-500" />
            <h2 className="font-semibold text-sm">Live Calls</h2>
            <Badge variant="secondary" className="text-xs ml-auto">{calls.length}</Badge>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-[#f5f5f5] rounded-lg animate-pulse" />
            ))
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Phone className="h-8 w-8 text-[#e0e0e0] mb-2" />
              <p className="text-sm text-[#6b6b6b]">No active calls</p>
              <p className="text-xs text-[#6b6b6b] mt-1">Calls in progress will appear here</p>
            </div>
          ) : calls.map(call => (
            <div
              key={call.id}
              className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                selected?.id === call.id
                  ? 'border-[#0a0a0a] bg-[#f5f5f5]'
                  : 'border-[#e0e0e0] hover:border-[#0a0a0a]/30'
              }`}
              onClick={() => setSelectedId(call.id)}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium truncate">{call.contact_name ?? 'Unknown'}</p>
                <span className="flex h-2 w-2 shrink-0 ml-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
              </div>
              <p className="text-xs text-[#6b6b6b] font-mono mb-1">{call.contact_phone ?? '—'}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#6b6b6b]">{call.agent?.name ?? 'Unknown agent'}</span>
                <ElapsedTimer since={call.created_at} />
              </div>
              {call.sentiment && (
                <span className={`text-xs font-medium ${sentimentColor(call.sentiment)}`}>
                  {call.sentiment}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right: selected call detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <Radio className="h-12 w-12 text-[#e0e0e0] mb-4" />
            <h3 className="font-semibold text-lg mb-1">Live Call Monitor</h3>
            <p className="text-sm text-[#6b6b6b]">Select an active call to view real-time details</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-5 border-b border-[#e0e0e0] flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{selected.contact_name ?? 'Unknown Contact'}</h3>
                <p className="text-sm text-[#6b6b6b]">{selected.contact_phone} · {selected.agent?.name}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-[#6b6b6b]">Duration</p>
                  <ElapsedTimer since={selected.created_at} />
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#6b6b6b]">Sentiment</p>
                  <p className={`text-sm font-medium capitalize ${sentimentColor(selected.sentiment)}`}>
                    {selected.sentiment ?? '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#6b6b6b]">Status</p>
                  <p className="text-sm font-medium text-green-600">{speakingLabel}</p>
                </div>
              </div>
            </div>

            {/* Transcript */}
            <div ref={transcriptRef} className="flex-1 overflow-y-auto p-5 space-y-3">
              {transcriptLines.length === 0 ? (
                <p className="text-sm text-[#6b6b6b] italic">Waiting for transcript…</p>
              ) : transcriptLines.map((line, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${line.role === 'agent' ? '' : 'flex-row-reverse'}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    line.role === 'agent' ? 'bg-[#0a0a0a] text-white' : 'bg-[#f5f5f5] text-[#0a0a0a] border border-[#e0e0e0]'
                  }`}>
                    {line.role === 'agent' ? 'A' : 'U'}
                  </div>
                  <Card className="max-w-md">
                    <CardContent className="p-3">
                      <p className="text-xs font-medium text-[#6b6b6b] mb-0.5 capitalize">{line.role}</p>
                      <p className="text-sm">{line.text}</p>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
