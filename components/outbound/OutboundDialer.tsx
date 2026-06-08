'use client';

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Phone, Upload, Play, Pause, RotateCcw,
  CheckCircle2, XCircle, Clock, Loader2,
  ChevronDown, ChevronUp, Settings2, AlertTriangle,
} from 'lucide-react';

type CallStatus = 'pending' | 'dialing' | 'success' | 'failed' | 'skipped';

interface DialRow {
  number: string;
  status: CallStatus;
  callId?: string;
  error?:  string;
  attempts: number;
}

interface Agent {
  id:   string;
  name: string;
}

interface PhoneNumber {
  number: string;
}

interface Props {
  agents: Agent[];
  phoneNumbers?: PhoneNumber[];
  hasSipTrunk?: boolean;
}

// Parse a text block (CSV or one-per-line) into E.164 numbers
function parseNumbers(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim().replace(/\s/g, ''))
    .filter((s) => s.length > 0)
    .map((s) => {
      if (/^\d{10,15}$/.test(s)) return `+${s}`;
      if (/^\+?[1-9]\d{6,14}$/.test(s)) return s.startsWith('+') ? s : `+${s}`;
      return s;
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
    success: { label: 'Success',  className: 'border-transparent bg-green-100 text-green-700 text-[10px]' },
    failed:  { label: 'Failed',   className: 'border-transparent bg-red-100 text-red-700 text-[10px]' },
    skipped: { label: 'Skipped',  className: 'border-[#e0e0e0] text-[#c0c0c0] bg-white text-[10px]' },
  };
  const s = m[status];
  return <Badge className={s.className}>{s.label}</Badge>;
}

const SELECT_CLS =
  'w-full h-9 rounded-lg border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] ' +
  'focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/20 disabled:opacity-50';

const INPUT_CLS =
  'w-full h-9 rounded-lg border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] ' +
  'focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/20 disabled:opacity-50 [appearance:textfield] ' +
  '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

export function OutboundDialer({ agents, phoneNumbers = [], hasSipTrunk = false }: Props) {
  // ── Core state ────────────────────────────────────────────────────────────
  const [expanded, setExpanded]       = useState(false);
  const [agentId, setAgentId]         = useState(agents[0]?.id ?? '');
  const [raw, setRaw]                 = useState('');
  const [concurrency, setConcurrency] = useState(2);
  const [rows, setRows]               = useState<DialRow[]>([]);
  const [running, setRunning]         = useState(false);
  const fileRef                       = useRef<HTMLInputElement>(null);
  const abortRef                      = useRef(false);

  // ── Advanced settings state ───────────────────────────────────────────────
  const [advancedOpen, setAdvancedOpen]     = useState(false);
  const [amdEnabled, setAmdEnabled]         = useState(false);
  const [amdAction, setAmdAction]           = useState<'hangup' | 'leave_voicemail'>('hangup');
  const [maxDuration, setMaxDuration]       = useState(10);   // minutes
  const [ringingTimeout, setRingingTimeout] = useState(25);  // seconds
  const [selectedCallerId, setSelectedCallerId] = useState('');
  const [maxRetries, setMaxRetries]         = useState(2);   // retry attempts
  const [retryIntervalMin, setRetryIntervalMin] = useState(5); // minutes between retries

  // ── Row mutation helper ───────────────────────────────────────────────────
  const liveRowsRef = useRef<DialRow[]>([]);
  const updateRow = useCallback((index: number, patch: Partial<DialRow>) => {
    setRows((prev) => {
      const next = prev.map((r, i) => i === index ? { ...r, ...patch } : r);
      liveRowsRef.current = next;
      return next;
    });
  }, []);

  // ── Poll actual call outcome (no-answer / voicemail / completed) ─────────
  async function pollCallOutcome(roomName: string, timeoutMs: number): Promise<string> {
    const TERMINAL = new Set(['completed', 'no_answer', 'failed', 'voicemail', 'cancelled']);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const r = await fetch(`/api/calls/dial/status?room=${encodeURIComponent(roomName)}`);
        if (r.ok) {
          const j = await r.json() as { status: string };
          if (TERMINAL.has(j.status)) return j.status;
        }
      } catch { /* network hiccup — keep polling */ }
    }
    return 'no_answer'; // timed out waiting for result
  }

  // ── Dial a single number ──────────────────────────────────────────────────
  async function dialOne(row: DialRow, index: number): Promise<void> {
    if (abortRef.current) { updateRow(index, { status: 'skipped' }); return; }
    updateRow(index, { status: 'dialing' });
    try {
      const res = await fetch('/api/calls/dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          to: row.number,
          amd_enabled:         amdEnabled,
          amd_action:          amdEnabled ? amdAction : undefined,
          max_duration_min:    maxDuration,
          ringing_timeout_sec: ringingTimeout,
          caller_id:           selectedCallerId || undefined,
        }),
      });
      const data = await res.json() as { call_id?: string; error?: string };
      if (!res.ok) {
        updateRow(index, { status: 'failed', error: data.error ?? `HTTP ${res.status}`, attempts: row.attempts + 1 });
        return;
      }

      const roomName = data.call_id ?? '';
      updateRow(index, { status: 'dialing', callId: roomName, attempts: row.attempts + 1 });

      // Wait for the actual call outcome: ring time + full max call duration + 60s buffer
      // for webhook round-trip. Without maxDuration here, any call longer than
      // ringingTimeout+30s would time out and be incorrectly marked failed.
      const pollTimeout = (ringingTimeout + maxDuration * 60 + 60) * 1000;
      const finalStatus = roomName ? await pollCallOutcome(roomName, pollTimeout) : 'no_answer';

      if (finalStatus === 'completed') {
        updateRow(index, { status: 'success' });
      } else {
        // no_answer, voicemail, failed, cancelled → eligible for retry
        updateRow(index, { status: 'failed', error: finalStatus });
      }
    } catch (err) {
      updateRow(index, { status: 'failed', error: String(err), attempts: row.attempts + 1 });
    }
  }

  // ── Dial a batch of rows (indexed pairs so retries land on the right row) ──
  async function dialBatch(indexed: Array<{ row: DialRow; index: number }>): Promise<void> {
    for (let i = 0; i < indexed.length; i += concurrency) {
      if (abortRef.current) break;
      const slice = indexed.slice(i, i + concurrency);
      await Promise.allSettled(slice.map(({ row, index }) => dialOne(row, index)));
      if (i + concurrency < indexed.length && !abortRef.current) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  // ── Start batched dialing with auto-retry ─────────────────────────────────
  async function startDial() {
    const numbers = parseNumbers(raw);
    if (!numbers.length) { toast.error('Enter at least one phone number.'); return; }
    if (!agentId)        { toast.error('Select an agent.'); return; }

    const initialRows: DialRow[] = numbers.map((n) => ({ number: n, status: 'pending', attempts: 0 }));
    liveRowsRef.current = initialRows;
    setRows(initialRows);
    setRunning(true);
    abortRef.current = false;

    // First pass
    await dialBatch(initialRows.map((row, index) => ({ row, index })));

    // Retry passes — use liveRowsRef to get up-to-date statuses without React state lag
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (abortRef.current) break;

      const failedIndexes = liveRowsRef.current
        .map((r, i) => (r.status === 'failed' ? i : -1))
        .filter((i) => i !== -1);

      if (failedIndexes.length === 0) break;

      // Show countdown toast and wait
      const toastId = toast.loading(
        `Retry ${attempt}/${maxRetries}: redialing ${failedIndexes.length} number${failedIndexes.length > 1 ? 's' : ''} in ${retryIntervalMin} min…`,
        { duration: retryIntervalMin * 60 * 1000 }
      );
      await new Promise((r) => setTimeout(r, retryIntervalMin * 60 * 1000));
      toast.dismiss(toastId);

      if (abortRef.current) break;

      // Reset failed rows to pending
      setRows((prev) => {
        const next = prev.map((r, i) =>
          failedIndexes.includes(i) ? { ...r, status: 'pending' as CallStatus } : r
        );
        liveRowsRef.current = next;
        return next;
      });

      // Re-dial the failed rows
      const toRetry = failedIndexes.map((i) => ({ row: liveRowsRef.current[i]!, index: i }));
      await dialBatch(toRetry);
    }

    setRunning(false);
    toast.success('Dial session complete.');
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

  // ── Stats ─────────────────────────────────────────────────────────────────
  const total   = rows.length;
  const done    = rows.filter((r) => r.status === 'success').length;
  const failed  = rows.filter((r) => r.status === 'failed').length;
  const pending = rows.filter((r) => r.status === 'pending').length;
  const pct     = total > 0 ? Math.round(((done + failed) / total) * 100) : 0;
  const parsedCount = parseNumbers(raw).length;

  return (
    <Card className="border-[#e5e5e5]">
      {/* ── Header (always visible) ── */}
      <CardHeader className="pb-3">
        <button
          className="flex w-full items-center justify-between"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Phone className="h-4 w-4 text-[#0a0a0a] shrink-0" />
            <CardTitle className="text-base">Quick Outbound Dialer</CardTitle>
            <Badge variant="secondary" className="text-[10px]">Beta</Badge>
          </div>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-[#6b6b6b] shrink-0" />
            : <ChevronDown className="h-4 w-4 text-[#6b6b6b] shrink-0" />}
        </button>
        {expanded && (
          <CardDescription className="text-xs mt-1">
            Paste or upload phone numbers to trigger outbound AI calls.
            Requires Twilio or SIP Trunk configured.
          </CardDescription>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">

          {/* ── No-dialer warning ── */}
          {!hasSipTrunk && phoneNumbers.length === 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 leading-snug">
                <span className="font-semibold">No dialer configured.</span>{' '}
                To make calls, add a phone number in{' '}
                <a href="/numbers" className="underline font-medium hover:text-amber-900">/numbers</a>
                {' '}or connect a SIP trunk in{' '}
                <a href="/integrations" className="underline font-medium hover:text-amber-900">/integrations</a>.
                Any number with <span className="font-mono font-semibold">+</span> will dial once a provider is set up.
              </div>
            </div>
          )}

          {/* ── Config row (responsive) ── */}
          <div className="flex flex-col gap-3 md:flex-row">
            {/* Agent selector */}
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-[#0a0a0a]">Agent</label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                disabled={running}
                className={SELECT_CLS}
              >
                {agents.length === 0 && <option value="">No agents available</option>}
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {/* Concurrency */}
            <div className="w-full md:w-36 space-y-1">
              <label className="text-xs font-medium text-[#0a0a0a]">Concurrency</label>
              <select
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                disabled={running}
                className={SELECT_CLS}
              >
                {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n} at a time</option>)}
              </select>
            </div>

            {/* CSV upload */}
            <div className="w-full md:w-36 space-y-1">
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

          {/* ── Phone numbers textarea ── */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#0a0a0a]">
              Phone numbers{' '}
              <span className="text-[#a0a0a0] font-normal">(E.164 or 10-digit, one per line or comma-separated)</span>
            </label>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              disabled={running}
              rows={4}
              placeholder={`+12025551234\n+13105559876\n+19175550011`}
              className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm font-mono text-[#0a0a0a] placeholder:text-[#c0c0c0] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/20 resize-none disabled:opacity-50"
            />
            <p className="text-[11px] text-gray-500">
              {parsedCount > 0
                ? <><span className="font-medium text-[#0a0a0a]">{parsedCount}</span> number{parsedCount !== 1 ? 's' : ''} parsed</>
                : '0 numbers parsed'}
            </p>
          </div>

          {/* ── Advanced Call Settings accordion ── */}
          <div className="rounded-xl border border-[#f0f0f0] bg-[#fafafa]">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-xs font-medium text-[#6b6b6b] hover:text-[#0a0a0a] transition-colors"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              <span className="flex items-center gap-2">
                <Settings2 className="h-3.5 w-3.5" />
                Advanced Call Settings
              </span>
              {advancedOpen
                ? <ChevronUp className="h-3.5 w-3.5" />
                : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {advancedOpen && (
              <div className="px-4 pb-4 space-y-4 border-t border-[#f0f0f0]">

                {/* AMD toggle */}
                <div className="flex items-start justify-between gap-4 pt-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#0a0a0a]">Answering Machine Detection (AMD)</p>
                    <p className="text-[11px] text-[#a0a0a0] mt-0.5 leading-relaxed">
                      Detect voicemail automatically and choose what to do
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={amdEnabled}
                    onClick={() => setAmdEnabled((v) => !v)}
                    disabled={running}
                    className={[
                      'relative shrink-0 h-5 w-9 rounded-full transition-colors duration-200',
                      amdEnabled ? 'bg-[#0a0a0a]' : 'bg-[#d0d0d0]',
                      'disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/30',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                        amdEnabled ? 'translate-x-4' : 'translate-x-0',
                      ].join(' ')}
                    />
                  </button>
                </div>

                {/* AMD action (shown only when AMD is on) */}
                {amdEnabled && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#0a0a0a]">When voicemail is detected</label>
                    <select
                      value={amdAction}
                      onChange={(e) => setAmdAction(e.target.value as 'hangup' | 'leave_voicemail')}
                      disabled={running}
                      className={SELECT_CLS}
                    >
                      <option value="hangup">Hang up immediately</option>
                      <option value="leave_voicemail">Leave voice message</option>
                    </select>
                    <p className="text-[11px] text-[#a0a0a0]">
                      {amdAction === 'hangup'
                        ? 'Call will be cancelled automatically if a machine answers.'
                        : 'Agent will continue speaking and leave a message after the beep.'}
                    </p>
                  </div>
                )}

                {/* Max duration + ringing timeout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#0a0a0a]">Max Call Duration (min)</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={maxDuration}
                      onChange={(e) => setMaxDuration(Math.max(1, Math.min(60, Number(e.target.value))))}
                      disabled={running}
                      className={INPUT_CLS}
                    />
                    <p className="text-[11px] text-[#a0a0a0]">Hang up after this many minutes</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#0a0a0a]">Ringing Timeout (sec)</label>
                    <input
                      type="number"
                      min={10}
                      max={120}
                      value={ringingTimeout}
                      onChange={(e) => setRingingTimeout(Math.max(10, Math.min(120, Number(e.target.value))))}
                      disabled={running}
                      className={INPUT_CLS}
                    />
                    <p className="text-[11px] text-[#a0a0a0]">Hang up if not answered within this time</p>
                  </div>
                </div>

                {/* Caller ID selector */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#0a0a0a]">Caller ID</label>
                  <select
                    value={selectedCallerId}
                    onChange={(e) => setSelectedCallerId(e.target.value)}
                    disabled={running}
                    className={SELECT_CLS}
                  >
                    <option value="">Auto (workspace default)</option>
                    {phoneNumbers.map((pn) => (
                      <option key={pn.number} value={pn.number}>{pn.number}</option>
                    ))}
                  </select>
                  {phoneNumbers.length === 0 && (
                    <p className="text-[11px] text-[#a0a0a0]">
                      No numbers configured — add one in{' '}
                      <a href="/numbers" className="underline hover:text-[#0a0a0a]">/numbers</a>.
                    </p>
                  )}
                </div>

                {/* Retry settings */}
                <div className="pt-2 border-t border-[#f0f0f0]">
                  <p className="text-xs font-medium text-[#0a0a0a] mb-3">Auto-Retry (failed calls)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[#0a0a0a]">Max Retries</label>
                      <input
                        type="number"
                        min={0}
                        max={5}
                        value={maxRetries}
                        onChange={(e) => setMaxRetries(Math.max(0, Math.min(5, Number(e.target.value))))}
                        disabled={running}
                        className={INPUT_CLS}
                      />
                      <p className="text-[11px] text-[#a0a0a0]">0 = no retry, max 5</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[#0a0a0a]">Retry Wait (min)</label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={retryIntervalMin}
                        onChange={(e) => setRetryIntervalMin(Math.max(1, Math.min(60, Number(e.target.value))))}
                        disabled={running || maxRetries === 0}
                        className={INPUT_CLS}
                      />
                      <p className="text-[11px] text-[#a0a0a0]">Wait before each retry</p>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* ── Progress bar ── */}
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

          {/* ── Action buttons ── */}
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
                  Start Dialing
                  {parsedCount > 0 && (
                    <span className="ml-1 opacity-70">({parsedCount})</span>
                  )}
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

          {/* ── Per-number status list ── */}
          {rows.length > 0 && (
            <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
              <div className="max-h-72 overflow-y-auto divide-y divide-[#f5f5f5]">
                {rows.map((row, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    {/* Status icon */}
                    <div className="mt-0.5 shrink-0">
                      <StatusIcon status={row.status} />
                    </div>

                    {/* Number + error */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[13px] font-medium text-[#0a0a0a]">{row.number}</span>
                        {statusBadge(row.status)}
                        <span className="text-[11px] text-[#b0b0b0] ml-auto shrink-0">
                          {row.attempts} {row.attempts === 1 ? 'try' : 'tries'}
                        </span>
                      </div>

                      {/* Error — full text, never truncated */}
                      {row.status === 'failed' && row.error && (
                        <p className="mt-1 text-xs text-red-600 leading-snug">{row.error}</p>
                      )}
                      {row.status === 'success' && row.callId && (
                        <p className="mt-0.5 text-[11px] font-mono text-green-700">
                          call id: {row.callId.slice(-16)}
                        </p>
                      )}
                    </div>
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
