'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  Info,
  Lightbulb,
  Loader2,
  MessageSquare,
  RefreshCw,
  Shield,
  ShieldAlert,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssistAlert {
  id: string;
  type: 'danger' | 'warning' | 'info' | 'opportunity';
  message: string;
  action_suggestion?: string;
  timestamp: Date;
}

interface AssistResponse {
  alerts: {
    type: 'danger' | 'warning' | 'info' | 'opportunity';
    message: string;
    action_suggestion?: string;
  }[];
  suggested_response?: string;
  compliance_risk: 'none' | 'low' | 'medium' | 'high';
  coaching_tip?: string;
  key_topics?: string[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ALERT_CFG = {
  danger: {
    bg:      'bg-red-50',
    border:  'border-red-200',
    text:    'text-red-800',
    subtext: 'text-red-600',
    icon:    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />,
    badge:   'bg-red-100 text-red-700 border-red-200',
    label:   'Danger',
    dot:     'bg-red-500',
  },
  warning: {
    bg:      'bg-yellow-50',
    border:  'border-yellow-200',
    text:    'text-yellow-900',
    subtext: 'text-yellow-700',
    icon:    <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />,
    badge:   'bg-yellow-100 text-yellow-800 border-yellow-200',
    label:   'Warning',
    dot:     'bg-yellow-500',
  },
  info: {
    bg:      'bg-blue-50',
    border:  'border-blue-200',
    text:    'text-blue-900',
    subtext: 'text-blue-700',
    icon:    <Info className="h-4 w-4 text-blue-600 shrink-0" />,
    badge:   'bg-blue-100 text-blue-800 border-blue-200',
    label:   'Info',
    dot:     'bg-blue-500',
  },
  opportunity: {
    bg:      'bg-green-50',
    border:  'border-green-200',
    text:    'text-green-900',
    subtext: 'text-green-700',
    icon:    <Lightbulb className="h-4 w-4 text-green-600 shrink-0" />,
    badge:   'bg-green-100 text-green-800 border-green-200',
    label:   'Opportunity',
    dot:     'bg-green-500',
  },
};

const RISK_CFG = {
  none:   { label: 'No Risk',       dot: 'bg-gray-400',   text: 'text-gray-600',   pill: 'bg-gray-100 text-gray-700 border-gray-200'   },
  low:    { label: 'Low Risk',      dot: 'bg-green-500',  text: 'text-green-700',  pill: 'bg-green-50 text-green-700 border-green-200'  },
  medium: { label: 'Medium Risk',   dot: 'bg-yellow-500', text: 'text-yellow-700', pill: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  high:   { label: 'High Risk',     dot: 'bg-red-500',    text: 'text-red-700',    pill: 'bg-red-50 text-red-800 border-red-200'         },
};

const DEBOUNCE_MS = 3000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 5)  return 'just now';
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Alert Card ───────────────────────────────────────────────────────────────

function AlertCard({
  alert,
  onDismiss,
  isNew,
}: {
  alert: AssistAlert;
  onDismiss: (id: string) => void;
  isNew: boolean;
}) {
  const cfg = ALERT_CFG[alert.type];
  const [, forceUpdate] = useState(0);

  // Re-render every 15s to update relative time
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 15_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`rounded-xl border p-3.5 space-y-2 transition-all duration-300 ${cfg.bg} ${cfg.border} ${
        isNew ? 'ring-2 ring-offset-1 ring-current/20 animate-in fade-in slide-in-from-top-2' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        {cfg.icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.badge}`}>
              {cfg.label}
            </span>
            <span className={`text-[10px] ${cfg.subtext} flex items-center gap-1`}>
              <Clock className="h-2.5 w-2.5" />
              {relativeTime(alert.timestamp)}
            </span>
          </div>
          <p className={`text-sm font-medium leading-snug ${cfg.text}`}>{alert.message}</p>
        </div>
        <button
          onClick={() => onDismiss(alert.id)}
          className={`shrink-0 p-0.5 rounded ${cfg.subtext} hover:opacity-70 transition-opacity`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {alert.action_suggestion && (
        <div className={`rounded-lg px-2.5 py-2 text-xs leading-relaxed bg-white/60 ${cfg.text} border ${cfg.border}`}>
          <span className="font-semibold">Suggested action: </span>
          {alert.action_suggestion}
        </div>
      )}
    </div>
  );
}

// ─── Countdown ring ───────────────────────────────────────────────────────────

function CountdownRing({ fraction }: { fraction: number }) {
  const r = 9;
  const circ = 2 * Math.PI * r;
  const filled = (1 - fraction) * circ;
  return (
    <svg width={22} height={22} className="-rotate-90" viewBox="0 0 22 22">
      <circle cx={11} cy={11} r={r} fill="none" stroke="#e8e8e8" strokeWidth={3} />
      <circle
        cx={11} cy={11} r={r}
        fill="none"
        stroke="#111"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.1s linear' }}
      />
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentAssistPage() {
  const [transcript, setTranscript]         = useState('');
  const [alerts, setAlerts]                 = useState<AssistAlert[]>([]);
  const [suggestedResponse, setSuggested]   = useState<string>('');
  const [complianceRisk, setRisk]           = useState<'none' | 'low' | 'medium' | 'high'>('none');
  const [coachingTip, setCoachingTip]       = useState<string>('');
  const [keyTopics, setKeyTopics]           = useState<string[]>([]);
  const [analyzing, setAnalyzing]           = useState(false);
  const [active, setActive]                 = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<Date | null>(null);
  const [newAlertIds, setNewAlertIds]       = useState<Set<string>>(new Set());
  const [countdown, setCountdown]           = useState(0); // 0–1 fraction
  const [alertHistory, setAlertHistory]     = useState<AssistAlert[]>([]);
  const [showHistory, setShowHistory]       = useState(false);

  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTranscript = useRef('');

  const MAX_ALERTS = 5;

  // Clear countdown interval on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current)  clearTimeout(debounceRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const runAnalysis = useCallback(async (text: string) => {
    if (!text.trim() || text.trim().length < 30) return;
    if (analyzing) return;

    setAnalyzing(true);
    setCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);

    try {
      const res = await fetch('/api/qac/assist', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ transcript: text }),
      });

      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Analysis failed');
      }

      const data = await res.json() as AssistResponse;

      // Build new alert objects
      const newAlerts: AssistAlert[] = (data.alerts ?? []).map(a => ({
        ...a,
        id:        genId(),
        timestamp: new Date(),
      }));

      const newIds = new Set(newAlerts.map(a => a.id));
      setNewAlertIds(newIds);
      setTimeout(() => setNewAlertIds(new Set()), 2500);

      // Keep last MAX_ALERTS active
      setAlerts(prev => {
        const combined = [...newAlerts, ...prev];
        return combined.slice(0, MAX_ALERTS);
      });

      // Archive to history
      setAlertHistory(prev => [...newAlerts, ...prev].slice(0, 50));

      if (data.suggested_response)            setSuggested(data.suggested_response);
      if (data.compliance_risk)               setRisk(data.compliance_risk);
      if (data.coaching_tip)                  setCoachingTip(data.coaching_tip);
      if (data.key_topics?.length)            setKeyTopics(data.key_topics);
      setLastAnalyzedAt(new Date());
    } catch (e) {
      toast.error(`Assist analysis failed: ${String(e)}`);
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing]);

  // Debounced auto-analyze — kick off on every transcript change when active
  function handleTranscriptChange(value: string) {
    setTranscript(value);

    if (!active) return;
    if (debounceRef.current)  clearTimeout(debounceRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Animate countdown ring
    const startMs = Date.now();
    setCountdown(1);
    countdownRef.current = setInterval(() => {
      const elapsed = Date.now() - startMs;
      const remaining = Math.max(0, 1 - elapsed / DEBOUNCE_MS);
      setCountdown(remaining);
      if (elapsed >= DEBOUNCE_MS && countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }, 80);

    debounceRef.current = setTimeout(() => {
      if (value !== lastTranscript.current) {
        lastTranscript.current = value;
        void runAnalysis(value);
      }
    }, DEBOUNCE_MS);
  }

  function handleManualAnalyze() {
    if (debounceRef.current)  clearTimeout(debounceRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(0);
    lastTranscript.current = transcript;
    void runAnalysis(transcript);
  }

  function toggleActive() {
    setActive(a => !a);
    if (active) {
      if (debounceRef.current)  clearTimeout(debounceRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(0);
    }
  }

  function dismissAlert(id: string) {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  function clearAll() {
    setAlerts([]);
    setSuggested('');
    setCoachingTip('');
    setKeyTopics([]);
    setRisk('none');
  }

  async function copyResponse() {
    if (!suggestedResponse) return;
    await navigator.clipboard.writeText(suggestedResponse);
    toast.success('Response copied to clipboard');
  }

  const riskCfg = RISK_CFG[complianceRisk];
  const dangerCount     = alerts.filter(a => a.type === 'danger').length;
  const warningCount    = alerts.filter(a => a.type === 'warning').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-[#6b6b6b] hover:text-[#111] -ml-2">
          <Link href="/qa-center">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111] shrink-0">
            <Zap className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111] leading-tight">Live Agent Assist</h1>
            <p className="text-xs text-[#6b6b6b]">Real-time compliance and coaching guidance during calls</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Risk indicator */}
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${riskCfg.pill}`}>
            <Shield className="h-3.5 w-3.5" />
            <span className={`h-2 w-2 rounded-full ${riskCfg.dot}`} />
            {riskCfg.label}
          </div>

          {/* Active toggle */}
          <button
            onClick={toggleActive}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? 'bg-[#111] text-white border-transparent'
                : 'bg-white text-[#6b6b6b] border-[#e0e0e0] hover:border-[#111]'
            }`}
          >
            {active
              ? <><span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />Active</>
              : <><Circle className="h-3 w-3" />Inactive</>}
          </button>
        </div>
      </div>

      {/* ── Alert strip — danger/warning summary ─────────────────────── */}
      {(dangerCount > 0 || warningCount > 0) && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-800 font-medium flex-1">
            {dangerCount > 0 && (
              <><span className="font-bold">{dangerCount} critical alert{dangerCount !== 1 ? 's' : ''}</span> require immediate attention. </>
            )}
            {warningCount > 0 && (
              <span>{warningCount} warning{warningCount !== 1 ? 's' : ''} detected.</span>
            )}
          </p>
          <button
            onClick={clearAll}
            className="text-xs text-red-600 font-medium hover:underline shrink-0"
          >
            Dismiss all
          </button>
        </div>
      )}

      {/* ── Main layout: input + alerts ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* LEFT — Transcript input */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-[#efefef]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#6b6b6b]" />
                  Transcript
                </CardTitle>

                <div className="flex items-center gap-2">
                  {/* Countdown ring (only shows when active + typing) */}
                  {active && countdown > 0 && !analyzing && (
                    <div className="flex items-center gap-1.5 text-[10px] text-[#9b9b9b]">
                      <CountdownRing fraction={countdown} />
                      <span>analyzing in {Math.ceil(countdown * DEBOUNCE_MS / 1000)}s</span>
                    </div>
                  )}

                  {analyzing && (
                    <div className="flex items-center gap-1.5 text-xs text-[#6b6b6b]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Analyzing…</span>
                    </div>
                  )}

                  {lastAnalyzedAt && !analyzing && (
                    <span className="text-[10px] text-[#c0c0c0]">
                      Last analyzed {relativeTime(lastAnalyzedAt)}
                    </span>
                  )}
                </div>
              </div>
              {active && (
                <p className="text-[11px] text-[#9b9b9b] mt-0.5">
                  Auto-analyzing every {DEBOUNCE_MS / 1000}s after you stop typing.
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={transcript}
                onChange={e => handleTranscriptChange(e.target.value)}
                placeholder={`Paste or type the recent call transcript here…\n\nAgent: Thank you for calling, this is Maria. How can I help you today?\nCustomer: Hi, I'm calling about my account balance…\nAgent: Of course, I'd be happy to help with that…`}
                rows={14}
                className="font-mono text-[13px] resize-none focus-visible:ring-[#111]"
              />

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleManualAnalyze}
                  disabled={analyzing || transcript.trim().length < 30}
                  size="sm"
                  className="gap-1.5"
                >
                  {analyzing
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Analyzing…</>
                    : <><Zap className="h-3.5 w-3.5" />Analyze Now</>}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setTranscript(''); clearAll(); lastTranscript.current = ''; }}
                  disabled={analyzing}
                  className="gap-1.5 text-[#6b6b6b]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Clear
                </Button>
                <span className="ml-auto text-[10px] text-[#c0c0c0]">
                  {transcript.length} chars
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Suggested Response */}
          <Card className="border-[#efefef]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#6b6b6b]" />
                  Suggested Response
                </CardTitle>
                {suggestedResponse && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyResponse}
                    className="gap-1.5 h-7 text-xs"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {suggestedResponse ? (
                <div className="relative">
                  <div className="rounded-xl bg-[#f8f8f8] border border-[#efefef] p-4 text-sm text-[#333] leading-relaxed whitespace-pre-wrap font-medium">
                    {suggestedResponse}
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-green-50 text-green-700 border-green-100 text-[9px]">
                      AI Suggestion
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <MessageSquare className="h-8 w-8 text-[#e0e0e0] mx-auto mb-2" />
                  <p className="text-sm text-[#9b9b9b]">
                    {analyzing
                      ? 'Generating suggested response…'
                      : 'Run analysis to get a suggested response.'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — Alerts panel */}
        <div className="lg:col-span-2 space-y-4">

          {/* Alert panel */}
          <Card className={`border-[#efefef] ${dangerCount > 0 ? 'border-red-200' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className={`h-4 w-4 ${dangerCount > 0 ? 'text-red-500' : 'text-[#6b6b6b]'}`} />
                  Live Alerts
                  {alerts.length > 0 && (
                    <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold ${
                      dangerCount > 0 ? 'bg-red-500 text-white' : 'bg-[#111] text-white'
                    }`}>
                      {alerts.length}
                    </span>
                  )}
                </CardTitle>
                {alerts.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-[10px] text-[#9b9b9b] hover:text-[#555] font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {alerts.length === 0 && !analyzing ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-300 mx-auto mb-2" />
                  <p className="text-sm text-[#9b9b9b] font-medium">No alerts</p>
                  <p className="text-xs text-[#c0c0c0] mt-1">
                    {active
                      ? 'Monitoring for compliance issues…'
                      : 'Enable Active mode to start monitoring.'}
                  </p>
                </div>
              ) : analyzing && alerts.length === 0 ? (
                <div className="py-8 text-center">
                  <Loader2 className="h-7 w-7 animate-spin text-[#9b9b9b] mx-auto mb-2" />
                  <p className="text-sm text-[#9b9b9b]">Analyzing transcript…</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {alerts.map(alert => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onDismiss={dismissAlert}
                      isNew={newAlertIds.has(alert.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Coaching tip */}
          {coachingTip && (
            <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3.5">
              <TrendingUp className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Coaching Tip</p>
                <p className="text-sm text-blue-900 leading-relaxed">{coachingTip}</p>
              </div>
            </div>
          )}

          {/* Key topics */}
          {keyTopics.length > 0 && (
            <Card className="border-[#efefef]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[#6b6b6b] font-medium flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  Key Topics Detected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {keyTopics.map(topic => (
                    <span
                      key={topic}
                      className="inline-flex items-center rounded-full bg-[#f0f0f0] px-2.5 py-1 text-xs font-medium text-[#555]"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Alert History */}
          {alertHistory.length > 0 && (
            <Card className="border-[#efefef]">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-[#6b6b6b] font-medium flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Alert History ({alertHistory.length})
                  </CardTitle>
                  <button
                    onClick={() => setShowHistory(h => !h)}
                    className="text-[10px] text-[#9b9b9b] hover:text-[#555] font-medium"
                  >
                    {showHistory ? 'Hide' : 'Show'}
                  </button>
                </div>
              </CardHeader>
              {showHistory && (
                <CardContent className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {alertHistory.slice(0, 20).map(alert => {
                    const cfg = ALERT_CFG[alert.type];
                    return (
                      <div
                        key={alert.id}
                        className={`flex items-start gap-2 rounded-lg px-2.5 py-2 ${cfg.bg} border ${cfg.border}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 mt-1.5 ${cfg.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium leading-snug ${cfg.text}`}>{alert.message}</p>
                          <p className={`text-[10px] mt-0.5 ${cfg.subtext}`}>{relativeTime(alert.timestamp)}</p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          )}

          {/* Status card — when inactive */}
          {!active && alerts.length === 0 && (
            <Card className="border-dashed border-[#e0e0e0]">
              <CardContent className="py-6 text-center space-y-3">
                <div className="h-10 w-10 rounded-full bg-[#f5f5f5] flex items-center justify-center mx-auto">
                  <Zap className="h-5 w-5 text-[#c0c0c0]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#555]">Auto-analyze inactive</p>
                  <p className="text-xs text-[#9b9b9b] mt-1 max-w-[200px] mx-auto">
                    Enable Active mode to auto-analyze the transcript every {DEBOUNCE_MS / 1000}s.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={toggleActive}
                  className="gap-1.5"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Enable Active Mode
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Instructions / tips ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            icon:  <MessageSquare className="h-4 w-4 text-blue-600" />,
            bg:    'bg-blue-50 border-blue-100',
            title: 'Paste transcript',
            desc:  'Type or paste the call transcript. Update it as the conversation progresses.',
          },
          {
            icon:  <Zap className="h-4 w-4 text-yellow-600" />,
            bg:    'bg-yellow-50 border-yellow-100',
            title: 'Auto-analysis',
            desc:  `Enable Active mode — the AI analyzes every ${DEBOUNCE_MS / 1000}s after you stop typing.`,
          },
          {
            icon:  <ShieldAlert className="h-4 w-4 text-green-600" />,
            bg:    'bg-green-50 border-green-100',
            title: 'Act on alerts',
            desc:  'Critical alerts appear instantly. Follow suggestions to stay compliant.',
          },
        ].map(item => (
          <div key={item.title} className={`rounded-xl border px-4 py-3.5 flex items-start gap-3 ${item.bg}`}>
            <div className="shrink-0 mt-0.5">{item.icon}</div>
            <div>
              <p className="text-xs font-semibold text-[#111]">{item.title}</p>
              <p className="text-xs text-[#555] mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
