'use client';

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Phone, Upload, Play, Pause, RotateCcw,
  CheckCircle2, XCircle, Clock, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';

type CallStatus = 'pending' | 'dialing' | 'success' | 'failed' | 'skipped';

interface DialRow {
  number: string;
  status: CallStatus;
  callId?: string;
  error?:  string;
}

interface Agent {
  id:   string;
  name: string;
}

interface Props {
  agents: Agent[];
}

// Parse a text block (CSV or one-per-line) into E.164 numbers
function parseNumbers(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim().replace(/\s/g, ''))
    .filter((s) => s.length > 0)
    .map((s) => {
      // Normalize: add + if missing and looks like a number
      if (/^\d{10,15}$/.test(s)) return `+${s}`;
      if (/^\+?[1-9]\d{6,14}$/.test(s)) return s.startsWith('+') ? s : `+${s}`;
      return s; // keep as-is, will fail validation server-side
    });
}

function StatusIcon({ status }: { status: CallStatus }) {
  switch (status) {
    case 'pending':  return <Clock className="h-4 w-4 text-[#a0a0a0]" />;
    case 'dialing':  return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'success':  return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'failed':   return <XCircle className="h-4 w-4 text-red-500" />;
    case 'skipped':  return <XCircle className="h-4 w-4 text-[#c0c0c0]" />;
  }
}

function statusBadge(status: CallStatus) {
  const m: Record<CallStatus, { label: string; className: string }> = {
    pending: { label: 'Pending',  className: 'border-[#e0e0e0] text-[#6b6b6b] bg-white text-[10px]' },
    dialing: { label: 'Dialing',  className: 'border-transparent bg-blue-100 text-blue-700 text-[10px]' },
    success: { label: 'Dialing',  className: 'border-transparent bg-green-100 text-green-700 text-[10px]' },
    failed:  { label: 'Failed',   className: 'border-transparent bg-red-100 text-red-700 text-[10px]' },
    skipped: { label: 'Skipped',  className: 'border-[#e0e0e0] text-[#c0c0c0] bg-white text-[10px]' },
  };
  const s = m[status];
  return <Badge className={s.className}>{s.label}</Badge>;
}

export function OutboundDialer({ agents }: Props) {
  const [expanded, setExpanded]   = useState(false);
  const [agentId, setAgentId]     = useState(agents[0]?.id ?? '');
  const [raw, setRaw]             = useState('');
  const [concurrency, setConcurrency] = useState(2);
  const [rows, setRows]           = useState<DialRow[]>([]);
  const [running, setRunning]     = useState(false);
  const fileRef                   = useRef<HTMLInputElement>(null);
  const abortRef                  = useRef(false);

  const updateRow = useCallback((index: number, patch: Partial<DialRow>) => {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, ...patch } : r));
  }, []);

  async function dialOne(row: DialRow, index: number): Promise<void> {
    if (abortRef.current) { updateRow(index, { status: 'skipped' }); return; }
    updateRow(index, { status: 'dialing' });
    try {
      const res = await fetch('/api/calls/dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, to: row.number }),
      });
      const data = await res.json() as { call_id?: string; error?: string };
      if (!res.ok) {
        updateRow(index, { status: 'failed', error: data.error ?? `HTTP ${res.status}` });
      } else {
        updateRow(index, { status: 'success', callId: data.call_id });
      }
    } catch (err) {
      updateRow(index, { status: 'failed', error: String(err) });
    }
  }

  async function startDial() {
    const numbers = parseNumbers(raw);
    if (!numbers.length) { toast.error('Enter at least one phone number.'); return; }
    if (!agentId)        { toast.error('Select an agent.'); return; }

    const initialRows: DialRow[] = numbers.map((n) => ({ number: n, status: 'pending' }));
    setRows(initialRows);
    setRunning(true);
    abortRef.current = false;

    // Concurrency: process in batches of `concurrency`
    for (let i = 0; i < initialRows.length; i += concurrency) {
      if (abortRef.current) break;
      const batch = initialRows.slice(i, i + concurrency).map((_, j) => dialOne(initialRows[i + j]!, i + j));
      await Promise.allSettled(batch);
      // 1.5s gap between batches to avoid saturating Twilio
      if (i + concurrency < initialRows.length && !abortRef.current) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    setRunning(false);
    const succeeded = rows.filter((r) => r.status === 'success').length;
    toast.success(`Dial session complete — ${succeeded}/${initialRows.length} initiated.`);
  }

  function stopDial() { abortRef.current = true; }

  function reset() {
    setRows([]); setRaw(''); abortRef.current = false; setRunning(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRaw(ev.target?.result as string ?? '');
    reader.readAsText(file);
    e.target.value = '';
  }

  // Stats
  const total   = rows.length;
  const done    = rows.filter((r) => r.status === 'success').length;
  const failed  = rows.filter((r) => r.status === 'failed').length;
  const pending = rows.filter((r) => r.status === 'pending').length;
  const pct     = total > 0 ? Math.round(((done + failed) / total) * 100) : 0;

  return (
    <Card className="border-[#e5e5e5]">
      <CardHeader className="pb-3">
        <button
          className="flex w-full items-center justify-between"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-[#0a0a0a]" />
            <CardTitle className="text-base">Quick Outbound Dialer</CardTitle>
            <Badge variant="secondary" className="text-[10px]">Beta</Badge>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-[#6b6b6b]" /> : <ChevronDown className="h-4 w-4 text-[#6b6b6b]" />}
        </button>
        {expanded && (
          <CardDescription className="text-xs mt-1">
            Paste or upload phone numbers to trigger outbound AI calls. Requires Twilio configured.
          </CardDescription>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Config row */}
          <div className="grid grid-cols-3 gap-3">
            {/* Agent selector */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#0a0a0a]">Agent</label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                disabled={running}
                className="w-full h-9 rounded-lg border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/20 disabled:opacity-50"
              >
                {agents.length === 0 && <option value="">No agents</option>}
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {/* Concurrency */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#0a0a0a]">Concurrency</label>
              <select
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                disabled={running}
                className="w-full h-9 rounded-lg border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/20 disabled:opacity-50"
              >
                {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n} at a time</option>)}
              </select>
            </div>

            {/* CSV upload */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#0a0a0a]">CSV Upload</label>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={running}
                className="flex w-full h-9 items-center justify-center gap-1.5 rounded-lg border border-[#e0e0e0] border-dashed bg-white px-3 text-xs text-[#6b6b6b] hover:bg-[#f5f5f5] disabled:opacity-50 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" /> Upload CSV
              </button>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
            </div>
          </div>

          {/* Number input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#0a0a0a]">
              Phone numbers <span className="text-[#a0a0a0] font-normal">(E.164 or 10-digit, one per line or comma-separated)</span>
            </label>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              disabled={running}
              rows={4}
              placeholder={`+12025551234\n+13105559876\n+19175550011`}
              className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm font-mono text-[#0a0a0a] placeholder:text-[#c0c0c0] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/20 resize-none disabled:opacity-50"
            />
            <p className="text-[11px] text-[#a0a0a0]">
              {parseNumbers(raw).length} numbers parsed
            </p>
          </div>

          {/* Progress bar (when running or done) */}
          {total > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#6b6b6b]">
                <span>{done} success · {failed} failed · {pending} pending</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#f0f0f0] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${failed > 0 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {!running ? (
              <>
                <Button
                  size="sm"
                  onClick={startDial}
                  disabled={!raw.trim() || !agentId || agents.length === 0}
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-1.5" />
                  Start Dialing ({parseNumbers(raw).length} numbers)
                </Button>
                {total > 0 && (
                  <Button size="sm" variant="outline" onClick={reset}>
                    <RotateCcw className="h-4 w-4 mr-1.5" /> Reset
                  </Button>
                )}
              </>
            ) : (
              <Button size="sm" variant="destructive" onClick={stopDial} className="flex-1">
                <Pause className="h-4 w-4 mr-1.5" /> Stop After Current Batch
              </Button>
            )}
          </div>

          {/* Per-number status list */}
          {rows.length > 0 && (
            <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_1fr] gap-3 px-4 py-2 border-b border-[#f0f0f0] text-[11px] font-medium text-[#a0a0a0] uppercase tracking-wide">
                <span>Number</span><span>Status</span><span>Details</span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-[#f5f5f5]">
                {rows.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_100px_1fr] gap-3 px-4 py-2.5 items-center text-sm">
                    <span className="font-mono text-[13px] text-[#0a0a0a]">{row.number}</span>
                    <div className="flex items-center gap-1.5">
                      <StatusIcon status={row.status} />
                      {statusBadge(row.status)}
                    </div>
                    <span className="text-xs text-[#6b6b6b] truncate">
                      {row.status === 'success' && row.callId ? (
                        <span className="font-mono text-green-700">{row.callId.slice(-12)}</span>
                      ) : row.status === 'failed' && row.error ? (
                        <span className="text-red-600">{row.error}</span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
