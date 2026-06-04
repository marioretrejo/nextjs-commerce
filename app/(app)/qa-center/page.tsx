'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Activity, AlertTriangle, BookOpen, ChevronDown, ChevronRight,
  CheckCircle2, Code2, Copy, Globe, Loader2, MessageSquare, Phone, PlayCircle,
  Plus, Search, Settings2, ShieldAlert, TrendingDown, TrendingUp,
  Trash2, Users2, X, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CompliancePanel } from '../compliance/CompliancePanel';
import { ShieldCheck } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QACFlag {
  id: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  transcript_fragment?: string;
  regulation?: string;
  coaching_note?: string;
  timestamp_s?: number;
}

interface QACEvaluation {
  id: string;
  overall_score: number;
  risk_score: number;
  tone: string;
  summary: string;
  criteria_scores: { opening: number; compliance: number; objection_handling: number; closing: number; empathy: number };
  rules_applied: number;
  evaluated_at: string;
  qac_flags: QACFlag[];
}

interface QACInteraction {
  id: string;
  agent_name: string;
  agent_id: string | null;
  channel: string;
  duration_s: number | null;
  status: 'pending' | 'analyzing' | 'analyzed' | 'failed';
  created_at: string;
  qac_evaluations: QACEvaluation[];
}

interface QACRule {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  regulation: string | null;
  is_active: boolean;
  created_at: string;
}

interface QACStats {
  totalInteractions: number;
  analyzedInteractions: number;
  pendingInteractions: number;
  avgOverallScore: number | null;
  avgRiskScore: number | null;
  complianceRate: number | null;
  totalFlags: number;
  flagsBySeverity: { low: number; medium: number; high: number; critical: number };
  flagsByCategory: { compliance: number; quality: number; disclosure: number; prohibited: number; coaching: number };
  topRiskAgents: { name: string; interactions: number; avg_risk: number }[];
}

// ─── Config maps ──────────────────────────────────────────────────────────────

const SEV: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  low:      { bg: 'bg-gray-100',    text: 'text-gray-700',   dot: 'bg-gray-400',   label: 'Low'      },
  medium:   { bg: 'bg-yellow-50',   text: 'text-yellow-800', dot: 'bg-yellow-500', label: 'Medium'   },
  high:     { bg: 'bg-orange-50',   text: 'text-orange-800', dot: 'bg-orange-500', label: 'High'     },
  critical: { bg: 'bg-red-50',      text: 'text-red-800',    dot: 'bg-red-500',    label: 'Critical' },
};

const CAT_COLOR: Record<string, string> = {
  compliance:  'bg-red-50 text-red-700',
  quality:     'bg-blue-50 text-blue-700',
  disclosure:  'bg-purple-50 text-purple-700',
  prohibited:  'bg-gray-900 text-white',
  coaching:    'bg-green-50 text-green-700',
};

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  call:   <Phone className="h-3.5 w-3.5" />,
  chat:   <MessageSquare className="h-3.5 w-3.5" />,
  email:  <Activity className="h-3.5 w-3.5" />,
  sms:    <MessageSquare className="h-3.5 w-3.5" />,
  social: <Activity className="h-3.5 w-3.5" />,
  other:  <Activity className="h-3.5 w-3.5" />,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScorePill({ score, size = 'sm' }: { score: number; size?: 'sm' | 'lg' }) {
  const color = score >= 80 ? 'text-green-700 bg-green-50 border-green-200'
               : score >= 60 ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
               : score >= 40 ? 'text-orange-700 bg-orange-50 border-orange-200'
               :               'text-red-700 bg-red-50 border-red-200';
  const sz = size === 'lg' ? 'text-2xl font-bold px-3 py-1' : 'text-xs font-semibold px-2 py-0.5';
  return <span className={`inline-flex items-center rounded-full border ${color} ${sz}`}>{score}</span>;
}

const CRITERIA_LABELS: Record<string, string> = {
  opening:            'Call Introduction & Greeting',
  compliance:         'Compliance',
  objection_handling: 'Objection Handling',
  closing:            'Action & Closure',
  empathy:            'Empathy',
};

function ScoreGauge({ score }: { score: number }) {
  const r = 52, cx = 64, cy = 68;
  const circumference = 2 * Math.PI * r;
  const semi = circumference / 2;
  const filled = (score / 100) * semi;
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#ca8a04' : '#dc2626';
  const angle = (score / 100) * Math.PI;
  const dotX = cx - r * Math.cos(angle);
  const dotY = cy - r * Math.sin(angle);
  const rot = `rotate(-180, ${cx}, ${cy})`;
  return (
    <svg viewBox="0 0 128 78" className="w-44 mx-auto">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${semi} ${semi}`} transform={rot} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`} transform={rot} />
      {score > 0 && <circle cx={dotX} cy={dotY} r="5" fill={color} />}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="20" fontWeight="700" fill="#111">{score}%</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="8.5" fill="#9b9b9b">Overall Score</text>
      <text x={cx - r + 2} y={cy + 20} textAnchor="middle" fontSize="7.5" fill="#c0c0c0">0%</text>
      <text x={cx + r - 2} y={cy + 20} textAnchor="middle" fontSize="7.5" fill="#c0c0c0">100%</text>
    </svg>
  );
}

function RiskBar({ score }: { score: number }) {
  const color = score < 30 ? 'bg-green-500' : score < 60 ? 'bg-yellow-500' : score < 80 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-[#555] w-6 text-right">{score}</span>
    </div>
  );
}

// ─── Interaction Row ───────────────────────────────────────────────────────────

function InteractionRow({
  interaction, onAnalyze, analyzing,
}: {
  interaction: QACInteraction;
  onAnalyze: (id: string) => void;
  analyzing: string | null;
}) {
  const [open, setOpen] = useState(false);
  const evaluation = interaction.qac_evaluations?.[0];
  const flags = evaluation?.qac_flags ?? [];
  const criticalCount = flags.filter(f => f.severity === 'critical' || f.severity === 'high').length;
  const isBusy = analyzing === interaction.id || interaction.status === 'analyzing';

  return (
    <div className="border-b border-[#f0f0f0] last:border-0">
      {/* Summary row */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-[#fafafa] transition-colors select-none"
        onClick={() => evaluation && setOpen(o => !o)}
      >
        <span className="text-[#c0c0c0] w-4 shrink-0">
          {evaluation
            ? (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)
            : <span className="h-4 w-4 block" />}
        </span>

        {/* Channel */}
        <span className="flex items-center gap-1 text-[#9b9b9b] shrink-0">
          {CHANNEL_ICON[interaction.channel] ?? CHANNEL_ICON.other}
        </span>

        {/* Agent */}
        <span className="font-semibold text-sm text-[#111] w-36 truncate shrink-0">
          {interaction.agent_name}
        </span>

        {/* Date */}
        <span className="text-xs text-[#9b9b9b] w-28 shrink-0">
          {format(new Date(interaction.created_at), 'MMM d, HH:mm')}
        </span>

        {/* Overall score */}
        {evaluation ? (
          <ScorePill score={Math.round(Number(evaluation.overall_score))} />
        ) : (
          <span className="w-10" />
        )}

        {/* Failed criteria tags (Sedric-style) */}
        {evaluation?.criteria_scores && (() => {
          const failed = Object.entries(evaluation.criteria_scores)
            .filter(([, v]) => Math.round(Number(v)) < 70)
            .map(([k]) => CRITERIA_LABELS[k] ?? k);
          if (failed.length === 0) return null;
          const visible = failed.slice(0, 2);
          const extra = failed.length - visible.length;
          return (
            <div className="hidden lg:flex items-center gap-1 flex-wrap min-w-0 flex-1">
              {visible.map(label => (
                <span key={label} className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 whitespace-nowrap">
                  {label}
                </span>
              ))}
              {extra > 0 && (
                <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                  +{extra}
                </span>
              )}
            </div>
          );
        })()}

        {/* Risk */}
        {evaluation && (
          <div className="w-24 shrink-0 hidden xl:block">
            <RiskBar score={Math.round(Number(evaluation.risk_score))} />
          </div>
        )}

        {/* High/critical flags */}
        {criticalCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-semibold text-red-600 shrink-0">
            <AlertTriangle className="h-3.5 w-3.5" />
            {criticalCount}
          </span>
        )}

        {/* Tone */}
        {evaluation?.tone && (
          <span className={`text-[10px] font-medium capitalize px-1.5 py-0.5 rounded hidden lg:inline ${
            evaluation.tone === 'professional' || evaluation.tone === 'friendly' ? 'bg-green-50 text-green-700' :
            evaluation.tone === 'unprofessional' || evaluation.tone === 'aggressive' ? 'bg-red-50 text-red-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {evaluation.tone}
          </span>
        )}

        {/* Status */}
        <span className="ml-auto shrink-0">
          {interaction.status === 'analyzed'  && <Badge className="bg-green-50 text-green-700 border-transparent text-[10px]">Analyzed</Badge>}
          {interaction.status === 'analyzing' && <Badge className="bg-blue-50 text-blue-700 border-transparent text-[10px]"><Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />Analyzing</Badge>}
          {interaction.status === 'failed'    && <Badge className="bg-red-50 text-red-700 border-transparent text-[10px]">Failed</Badge>}
          {interaction.status === 'pending'   && <Badge variant="secondary" className="text-[10px]">Pending</Badge>}
        </span>

        {(interaction.status === 'pending' || interaction.status === 'failed') && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs shrink-0 gap-1"
            disabled={!!analyzing || isBusy}
            onClick={e => { e.stopPropagation(); onAnalyze(interaction.id); }}
          >
            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
            Analyze
          </Button>
        )}
      </div>

      {/* Expanded detail */}
      {open && evaluation && (
        <div className="px-5 pb-5 space-y-4 bg-[#fafafa] border-t border-[#f0f0f0]">
          {/* Summary */}
          {evaluation.summary && (
            <p className="text-sm text-[#555] pt-3">{evaluation.summary}</p>
          )}

          {/* Criteria scores */}
          {evaluation.criteria_scores && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {Object.entries(evaluation.criteria_scores).map(([key, val]) => {
                const v = Math.round(Number(val));
                return (
                  <div key={key} className="rounded-xl border border-[#efefef] bg-white p-2.5 text-center">
                    <p className="text-[10px] font-medium text-[#9b9b9b] capitalize mb-1.5">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <p className={`text-xl font-bold ${v >= 70 ? 'text-green-600' : v >= 45 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {v}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Flags */}
          {flags.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-[#9b9b9b] uppercase tracking-widest">
                {flags.length} Flag{flags.length !== 1 ? 's' : ''} Detected
              </p>
              {flags.map((flag) => {
                const sc = SEV[flag.severity] ?? SEV['medium']!;
                return (
                  <div key={flag.id} className={`rounded-xl p-3 ${sc.bg}`}>
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${sc.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold text-sm ${sc.text}`}>{flag.label}</span>
                          {flag.regulation && (
                            <span className="text-[10px] font-mono bg-black/[0.06] px-1.5 py-0.5 rounded">
                              {flag.regulation}
                            </span>
                          )}
                          <span className={`text-[10px] capitalize font-medium px-1.5 py-0.5 rounded ${CAT_COLOR[flag.category] ?? ''}`}>
                            {flag.category}
                          </span>
                        </div>
                        {flag.transcript_fragment && (
                          <p className={`text-xs italic border-l-2 border-current/20 pl-2 mt-1.5 mb-1 line-clamp-3 ${sc.text}`}>
                            "{flag.transcript_fragment}"
                          </p>
                        )}
                        {flag.coaching_note && (
                          <p className={`text-xs ${sc.text} opacity-80`}>
                            <span className="font-semibold">Coaching:</span> {flag.coaching_note}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl p-3 border border-green-100">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              No flags detected — fully compliant interaction.
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-[#c0c0c0]">
              Analyzed {format(new Date(evaluation.evaluated_at), 'MMM d, yyyy HH:mm')} · {evaluation.rules_applied} rules applied
            </p>
            <Link
              href={`/qa-center/calls/${interaction.id}`}
              className="flex items-center gap-1 text-[10px] font-medium text-[#9b9b9b] hover:text-[#111] transition-colors border border-[#e0e0e0] rounded-lg px-2 py-1 hover:border-[#111]"
              onClick={e => e.stopPropagation()}
            >
              View Full Review →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── QA Rules Manager (own UI, not shared with compliance page) ───────────────

function QACRulesManager() {
  const [rules, setRules]         = useState<QACRule[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);

  const [name, setName]           = useState('');
  const [desc, setDesc]           = useState('');
  const [category, setCategory]   = useState('quality');
  const [severity, setSeverity]   = useState('medium');
  const [regulation, setRegulation] = useState('');

  const fetchRules = useCallback(async () => {
    const res = await fetch('/api/qac/rules');
    if (res.ok) setRules(await res.json() as QACRule[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  async function createRule() {
    if (!name.trim() || !desc.trim()) { toast.error('Name and description are required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/qac/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: desc.trim(), category, severity, regulation: regulation.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      toast.success('Rule created');
      setName(''); setDesc(''); setCategory('quality'); setSeverity('medium'); setRegulation('');
      setShowForm(false);
      fetchRules();
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  async function toggleRule(id: string, is_active: boolean) {
    await fetch(`/api/qac/rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    });
    setRules(prev => prev.map(r => r.id === id ? { ...r, is_active } : r));
  }

  async function deleteRule(id: string) {
    await fetch(`/api/qac/rules/${id}`, { method: 'DELETE' });
    setRules(prev => prev.filter(r => r.id !== id));
    toast.success('Rule deleted');
  }

  if (loading) return <div className="h-48 bg-[#f5f5f5] rounded-xl animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[#111]">QA Rules</h3>
          <p className="text-xs text-[#6b6b6b] mt-0.5">
            Define what the AI auditor checks on every interaction. Each rule maps to a regulation and category.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(s => !s)} variant={showForm ? 'outline' : 'default'}>
          {showForm ? <><X className="h-3.5 w-3.5 mr-1" />Cancel</> : <><Plus className="h-3.5 w-3.5 mr-1" />Add Rule</>}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="border-[#e0e0e0]">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Rule Name <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. FDCPA Mini-Miranda Required" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Regulation Reference</Label>
                <Input placeholder="e.g. FDCPA §807(11), TCPA, GDPR Art.13" value={regulation} onChange={e => setRegulation(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-red-500">*</span></Label>
              <Textarea
                rows={2}
                placeholder="Describe what the agent must do or must not do..."
                value={desc}
                onChange={e => setDesc(e.target.value)}
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="disclosure">Disclosure</SelectItem>
                    <SelectItem value="prohibited">Prohibited</SelectItem>
                    <SelectItem value="quality">Quality</SelectItem>
                    <SelectItem value="coaching">Coaching</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={createRule} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                Create Rule
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules list */}
      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-8 w-8 text-[#e0e0e0] mx-auto mb-3" />
            <p className="text-sm font-medium text-[#555]">No QA rules yet</p>
            <p className="text-xs text-[#9b9b9b] mt-1 mb-4">
              Add rules to define what the AI checks on every interaction — disclosures, prohibited phrases, quality criteria.
            </p>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-[#f0f0f0]">
              {rules.map(rule => {
                const rs = SEV[rule.severity] ?? SEV['medium']!;
                return (
                  <div key={rule.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${rule.is_active ? rs.dot : 'bg-gray-200'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${rule.is_active ? 'text-[#111]' : 'text-[#9b9b9b]'}`}>
                          {rule.name}
                        </span>
                        {rule.regulation && (
                          <span className="text-[10px] font-mono bg-[#f0f0f0] px-1.5 py-0.5 rounded">
                            {rule.regulation}
                          </span>
                        )}
                        <span className={`text-[10px] capitalize font-medium px-1.5 py-0.5 rounded ${CAT_COLOR[rule.category] ?? 'bg-gray-100 text-gray-600'}`}>
                          {rule.category}
                        </span>
                      </div>
                      <p className="text-xs text-[#9b9b9b] mt-0.5 line-clamp-1">{rule.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={v => toggleRule(rule.id, v)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[#c0c0c0] hover:text-red-500"
                        onClick={() => deleteRule(rule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QACenterPage() {
  const [interactions, setInteractions] = useState<QACInteraction[]>([]);
  const [stats,        setStats]        = useState<QACStats | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [analyzing,    setAnalyzing]    = useState<string | null>(null);

  // Upload form
  const [agentName,    setAgentName]    = useState('');
  const [agentId,      setAgentId]      = useState('');
  const [channel,      setChannel]      = useState('call');
  const [transcript,   setTranscript]   = useState('');
  const [durationMin,  setDurationMin]  = useState('');
  const [submitting,   setSubmitting]   = useState(false);

  const [activeTab,    setActiveTab]    = useState('dashboard');
  const [interactionView, setInteractionView] = useState<'all' | 'flagged' | 'review'>('all');

  // ── Filter / Segmenter state ───────────────────────────────────────────────
  const [filterAgent,  setFilterAgent]  = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRange,  setFilterRange]  = useState('');  // 'today'|'week'|'month'|''
  const [filterRisk,   setFilterRisk]   = useState('');
  const [totalCount,   setTotalCount]   = useState(0);

  const buildInteractionsUrl = useCallback((agent: string, status: string, range: string, risk: string) => {
    const p = new URLSearchParams({ limit: '100' });
    if (agent)  p.set('agent',  agent);
    if (status) p.set('status', status);
    if (risk)   p.set('risk_level', risk);
    if (range) {
      const now = new Date();
      if (range === 'today') {
        const start = new Date(now); start.setHours(0, 0, 0, 0);
        p.set('date_from', start.toISOString());
      } else if (range === 'week') {
        const start = new Date(now); start.setDate(now.getDate() - 7);
        p.set('date_from', start.toISOString());
      } else if (range === 'month') {
        const start = new Date(now); start.setDate(now.getDate() - 30);
        p.set('date_from', start.toISOString());
      }
    }
    return `/api/qac/interactions?${p.toString()}`;
  }, []);

  const fetchAll = useCallback(async (agent = filterAgent, status = filterStatus, range = filterRange, risk = filterRisk) => {
    const url = buildInteractionsUrl(agent, status, range, risk);
    const [intRes, statsRes] = await Promise.all([
      fetch(url),
      fetch('/api/qac/stats'),
    ]);
    if (intRes.ok) {
      const d = await intRes.json() as { interactions: QACInteraction[]; total: number };
      setInteractions(d.interactions ?? []);
      setTotalCount(d.total ?? 0);
    }
    if (statsRes.ok) setStats(await statsRes.json() as QACStats);
    setLoading(false);
  }, [filterAgent, filterStatus, filterRange, filterRisk, buildInteractionsUrl]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const displayedInteractions = useMemo(() => {
    if (interactionView === 'flagged') {
      return interactions.filter(i => {
        const flags = i.qac_evaluations?.[0]?.qac_flags ?? [];
        return flags.some(f => f.severity === 'critical' || f.severity === 'high');
      });
    }
    if (interactionView === 'review') return interactions.filter(i => i.status === 'pending' || i.status === 'failed');
    return interactions;
  }, [interactions, interactionView]);

  const agentStats = useMemo(() => {
    const map = new Map<string, { name: string; count: number; scoreSum: number; scored: number; flagged: number; passed: number }>();
    for (const i of interactions) {
      if (!map.has(i.agent_name)) map.set(i.agent_name, { name: i.agent_name, count: 0, scoreSum: 0, scored: 0, flagged: 0, passed: 0 });
      const a = map.get(i.agent_name)!;
      a.count++;
      const ev = i.qac_evaluations?.[0];
      if (ev) {
        a.scoreSum += Number(ev.overall_score);
        a.scored++;
        if (Number(ev.overall_score) >= 70) a.passed++;
        if (ev.qac_flags?.some(f => f.severity === 'critical' || f.severity === 'high')) a.flagged++;
      }
    }
    return Array.from(map.values())
      .map(a => ({
        ...a,
        avgScore: a.scored > 0 ? Math.round(a.scoreSum / a.scored) : null,
        passRate: a.scored > 0 ? Math.round((a.passed / a.scored) * 100) : null,
      }))
      .sort((a, b) => (a.avgScore ?? 999) - (b.avgScore ?? 999));
  }, [interactions]);

  async function handleAnalyze(id: string) {
    setAnalyzing(id);
    setInteractions(prev => prev.map(i => i.id === id ? { ...i, status: 'analyzing' } : i));
    try {
      const res = await fetch(`/api/qac/interactions/${id}/analyze`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      toast.success('Analysis complete');
      await fetchAll();
    } catch (e) {
      toast.error(`Analysis failed: ${String(e)}`);
      setInteractions(prev => prev.map(i => i.id === id ? { ...i, status: 'failed' } : i));
    } finally {
      setAnalyzing(null);
    }
  }

  async function handleSubmit() {
    if (!agentName.trim())             { toast.error('Agent name is required'); return; }
    if (transcript.trim().length < 20) { toast.error('Transcript too short (min 20 chars)'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/qac/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: agentName.trim(),
          agent_id:   agentId.trim() || undefined,
          channel,
          transcript: transcript.trim(),
          duration_s: durationMin ? Math.round(Number(durationMin) * 60) : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      const newInt = await res.json() as QACInteraction;
      toast.success('Interaction uploaded — starting analysis…');
      setAgentName(''); setAgentId(''); setTranscript(''); setDurationMin(''); setChannel('call');
      setInteractions(prev => [{ ...newInt, qac_evaluations: [] }, ...prev]);
      setActiveTab('interactions');
      await handleAnalyze(newInt.id);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-9 w-40 bg-[#f5f5f5] rounded-lg animate-pulse mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-[#f5f5f5] rounded-xl animate-pulse" />)}
        </div>
        <div className="h-80 bg-[#f5f5f5] rounded-xl animate-pulse" />
      </div>
    );
  }

  const s = stats;
  const criticalFlags = s?.flagsBySeverity.critical ?? 0;
  const highFlags     = s?.flagsBySeverity.high ?? 0;

  return (
    <div className="p-6 mx-auto max-w-6xl space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111] shrink-0">
          <ShieldAlert className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-[#111]">QA Center</h1>
          <p className="text-sm text-[#6b6b6b]">
            100% QA coverage for call center interactions — AI-powered scoring, compliance flags, and agent coaching
          </p>
        </div>
        {s && criticalFlags + highFlags > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2 shrink-0">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-semibold text-red-700">
              {criticalFlags + highFlags} high-risk flag{criticalFlags + highFlags !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-9 w-full justify-start overflow-x-auto flex-nowrap scrollbar-none">
          <TabsTrigger value="dashboard" className="text-xs gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />Dashboard
          </TabsTrigger>
          <TabsTrigger value="interactions" className="text-xs gap-1.5">
            <Activity className="h-3.5 w-3.5" />Interactions
            {interactions.length > 0 && (
              <span className="ml-1 rounded-full bg-[#111] text-white text-[9px] px-1.5 py-px leading-none">
                {interactions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="new" className="text-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" />New Evaluation
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />QA Rules
          </TabsTrigger>
          <TabsTrigger value="compliance" className="text-xs gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />Compliance
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="text-xs gap-1.5">
            <Users2 className="h-3.5 w-3.5" />Monitoring
          </TabsTrigger>
          <TabsTrigger value="integrations" className="text-xs gap-1.5">
            <Globe className="h-3.5 w-3.5" />Integrations
          </TabsTrigger>
          <TabsTrigger value="docs" className="text-xs gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />Docs
          </TabsTrigger>
        </TabsList>

        {/* ── DASHBOARD ──────────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-4 pt-4">
          {/* KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Overall Score gauge — Sedric-style */}
            <Card className="flex flex-col items-center py-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] mb-2">Avg QA Score</p>
              <ScoreGauge score={s?.avgOverallScore ?? 0} />
              <p className="text-[10px] text-[#c0c0c0] mt-1">across {s?.analyzedInteractions ?? 0} analyzed calls</p>
            </Card>

            {/* Secondary metrics 2×2 */}
            <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-3xl font-bold text-[#111]">{s?.analyzedInteractions ?? 0}</p>
                  <p className="text-xs font-medium text-[#555] mt-1">Calls Analyzed</p>
                  <p className="text-[10px] text-[#9b9b9b]">of {s?.totalInteractions ?? 0} total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className={`text-3xl font-bold ${
                    (s?.complianceRate ?? 0) >= 80 ? 'text-green-600' :
                    (s?.complianceRate ?? 0) >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {s?.complianceRate !== null && s?.complianceRate !== undefined ? `${s.complianceRate}%` : '—'}
                  </p>
                  <p className="text-xs font-medium text-[#555] mt-1">Compliance Rate</p>
                  <p className="text-[10px] text-[#9b9b9b]">interactions with risk &lt; 30</p>
                </CardContent>
              </Card>
              <Card className={(criticalFlags + highFlags) > 0 ? 'border-red-200' : ''}>
                <CardContent className="pt-5 pb-4">
                  <p className={`text-3xl font-bold ${(criticalFlags + highFlags) > 0 ? 'text-red-600' : 'text-[#111]'}`}>
                    {criticalFlags + highFlags}
                  </p>
                  <p className="text-xs font-medium text-[#555] mt-1">High-Risk Flags</p>
                  <p className="text-[10px] text-[#9b9b9b]">critical + high severity</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-3xl font-bold text-[#111]">{s?.pendingInteractions ?? 0}</p>
                  <p className="text-xs font-medium text-[#555] mt-1">Pending Analysis</p>
                  <p className="text-[10px] text-[#9b9b9b]">awaiting QA review</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Flags by severity */}
            {s && s.totalFlags > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Flags by Severity</CardTitle>
                  <CardDescription>{s.totalFlags} total flags across all interactions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
                    const count = s?.flagsBySeverity[sev] ?? 0;
                    const total = s?.totalFlags ?? 0;
                    const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
                    const cfg   = SEV[sev]!;
                    return (
                      <div key={sev} className="flex items-center gap-3">
                        <span className={`capitalize text-xs font-semibold w-14 ${cfg.text}`}>{sev}</span>
                        <div className="flex-1 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${cfg.dot}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-bold text-[#555] w-6 text-right">{count}</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Top risk agents */}
            {s && s.topRiskAgents.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Top Risk Agents</CardTitle>
                  <CardDescription>Agents with highest average risk score</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {s.topRiskAgents.map((agent, i) => (
                    <div key={agent.name} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[#c0c0c0] w-4">{i + 1}</span>
                      <span className="text-sm font-medium text-[#111] flex-1 truncate">{agent.name}</span>
                      <span className="text-[10px] text-[#9b9b9b]">{agent.interactions} call{agent.interactions !== 1 ? 's' : ''}</span>
                      <div className="w-20">
                        <RiskBar score={agent.avg_risk} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Flags by category */}
            {s && s.totalFlags > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Flags by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(s.flagsByCategory).filter(([, v]) => v > 0).map(([cat, count]) => (
                      <div key={cat} className={`rounded-lg px-3 py-2 flex items-center justify-between ${CAT_COLOR[cat] ?? 'bg-gray-100 text-gray-600'}`}>
                        <span className="text-xs font-medium capitalize">{cat}</span>
                        <span className="text-sm font-bold">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Before/After comparison (Sedric-style insight) */}
          {s && s.totalInteractions === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center space-y-3">
                <ShieldAlert className="h-10 w-10 text-[#e0e0e0] mx-auto" />
                <p className="font-semibold text-[#555]">Zero interactions analyzed yet</p>
                <p className="text-sm text-[#9b9b9b] max-w-sm mx-auto">
                  Traditional QA reviews only 1–5% of calls. Upload your first interaction and get 100% AI-powered coverage.
                </p>
                <Button size="sm" onClick={() => setActiveTab('new')}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Upload First Interaction
                </Button>
              </CardContent>
            </Card>
          )}

          {s && s.pendingInteractions > 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="py-3 flex items-center gap-3">
                <TrendingDown className="h-4 w-4 text-yellow-600 shrink-0" />
                <p className="text-sm text-yellow-800">
                  <span className="font-semibold">{s.pendingInteractions} interaction{s.pendingInteractions !== 1 ? 's' : ''}</span> pending analysis —
                  go to <button className="underline font-medium" onClick={() => setActiveTab('interactions')}>Interactions</button> to run them.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── INTERACTIONS ───────────────────────────────────────────── */}
        <TabsContent value="interactions" className="pt-4 space-y-3">
          {/* Sedric-style view tabs */}
          <div className="flex items-center gap-0 border-b border-[#e0e0e0] -mb-1">
            {([
              ['all',     'All',       interactions.length],
              ['flagged', 'Flagged',   interactions.filter(i => i.qac_evaluations?.[0]?.qac_flags?.some(f => f.severity === 'critical' || f.severity === 'high')).length],
              ['review',  'To review', interactions.filter(i => i.status === 'pending' || i.status === 'failed').length],
            ] as [string, string, number][]).map(([val, label, count]) => (
              <button
                key={val}
                onClick={() => setInteractionView(val as 'all' | 'flagged' | 'review')}
                className={`relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                  interactionView === val
                    ? 'text-[#111] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#111] after:rounded-t'
                    : 'text-[#9b9b9b] hover:text-[#555]'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${
                    interactionView === val ? 'bg-[#111] text-white' : 'bg-[#f0f0f0] text-[#6b6b6b]'
                  }`}>{count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Agent search */}
            <div className="relative flex-1 min-w-[160px] max-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9b9b9b] pointer-events-none" />
              <input
                className="w-full h-8 rounded-lg border border-[#e0e0e0] bg-white pl-8 pr-3 text-xs placeholder:text-[#b0b0b0] focus:outline-none focus:ring-1 focus:ring-[#111]"
                placeholder="Filter by agent…"
                value={filterAgent}
                onChange={e => {
                  setFilterAgent(e.target.value);
                  void fetchAll(e.target.value, filterStatus, filterRange, filterRisk);
                }}
              />
            </div>

            {/* Status */}
            <select
              className="h-8 rounded-lg border border-[#e0e0e0] bg-white px-2.5 text-xs text-[#555] focus:outline-none focus:ring-1 focus:ring-[#111]"
              value={filterStatus}
              onChange={e => {
                setFilterStatus(e.target.value);
                void fetchAll(filterAgent, e.target.value, filterRange, filterRisk);
              }}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="analyzed">Analyzed</option>
              <option value="analyzing">Analyzing</option>
              <option value="failed">Failed</option>
            </select>

            {/* Date range */}
            <div className="flex items-center rounded-lg border border-[#e0e0e0] bg-white p-0.5 gap-px">
              {([['', 'All'], ['today', 'Today'], ['week', '7d'], ['month', '30d']] as [string, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => { setFilterRange(val); void fetchAll(filterAgent, filterStatus, val, filterRisk); }}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                    filterRange === val ? 'bg-[#111] text-white' : 'text-[#6b6b6b] hover:text-[#111] hover:bg-[#f5f5f5]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Risk level */}
            <select
              className="h-8 rounded-lg border border-[#e0e0e0] bg-white px-2.5 text-xs text-[#555] focus:outline-none focus:ring-1 focus:ring-[#111]"
              value={filterRisk}
              onChange={e => {
                setFilterRisk(e.target.value);
                void fetchAll(filterAgent, filterStatus, filterRange, e.target.value);
              }}
            >
              <option value="">All risk levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Clear filters */}
            {(filterAgent || filterStatus || filterRange || filterRisk) && (
              <button
                className="flex items-center gap-1 text-[10px] font-medium text-[#9b9b9b] hover:text-[#111] transition-colors"
                onClick={() => {
                  setFilterAgent(''); setFilterStatus(''); setFilterRange(''); setFilterRisk('');
                  void fetchAll('', '', '', '');
                }}
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-[#9b9b9b]">
                {displayedInteractions.length}{totalCount > interactions.length ? ` of ${totalCount}` : ''} interaction{displayedInteractions.length !== 1 ? 's' : ''}
                {' · '}{displayedInteractions.filter(i => i.status === 'analyzed').length} analyzed
              </span>
              {displayedInteractions.some(i => i.status === 'pending' || i.status === 'failed') && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!analyzing}
                  onClick={async () => {
                    const pending = displayedInteractions.filter(i => i.status === 'pending' || i.status === 'failed');
                    for (const p of pending) await handleAnalyze(p.id);
                  }}
                >
                  {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <PlayCircle className="h-3.5 w-3.5 mr-1.5" />}
                  Analyze All Pending
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="p-0 mt-0">
              {displayedInteractions.length === 0 ? (
                <div className="py-16 text-center">
                  <Activity className="h-8 w-8 text-[#e0e0e0] mx-auto mb-3" />
                  {filterAgent || filterStatus || filterRange || filterRisk || interactionView !== 'all' ? (
                    <>
                      <p className="text-sm text-[#555] font-medium">No interactions match the current filters</p>
                      <p className="text-xs text-[#9b9b9b] mt-1 mb-4">Try adjusting or clearing the filters above.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-[#555] font-medium">No interactions uploaded</p>
                      <p className="text-xs text-[#9b9b9b] mt-1 mb-4">Upload a call center transcript to start 100% QA coverage.</p>
                      <Button size="sm" onClick={() => setActiveTab('new')}>
                        <Plus className="h-4 w-4 mr-1.5" /> New Evaluation
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  {/* Table header */}
                  <div className="hidden md:flex items-center gap-3 px-5 py-2 border-b border-[#f0f0f0] text-[10px] font-semibold text-[#9b9b9b] uppercase tracking-wider">
                    <span className="w-4" />
                    <span className="w-4" />
                    <span className="w-36">Agent</span>
                    <span className="w-28">Date</span>
                    <span className="w-10">Score</span>
                    <span className="flex-1">Failed Criteria</span>
                    <span className="w-12">Flags</span>
                    <span className="w-16" />
                  </div>
                  {displayedInteractions.map(interaction => (
                    <InteractionRow
                      key={interaction.id}
                      interaction={interaction}
                      onAnalyze={handleAnalyze}
                      analyzing={analyzing}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NEW EVALUATION ─────────────────────────────────────────── */}
        <TabsContent value="new" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>New Interaction Evaluation</CardTitle>
              <CardDescription>
                Paste the transcript of a human agent interaction. The AI auditor will score it across 5 dimensions,
                flag violations with regulation references, and generate coaching notes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Agent Name <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="e.g. Maria González"
                    value={agentName}
                    onChange={e => setAgentName(e.target.value)}
                  />
                  <p className="text-xs text-[#9b9b9b]">Name of the human call center agent</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Agent ID <span className="text-[#9b9b9b] font-normal">(optional)</span></Label>
                  <Input
                    placeholder="e.g. EMP-0042"
                    value={agentId}
                    onChange={e => setAgentId(e.target.value)}
                  />
                  <p className="text-xs text-[#9b9b9b]">Internal HR or CRM identifier</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Channel</Label>
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Phone Call</SelectItem>
                      <SelectItem value="chat">Live Chat</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="social">Social Media</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Duration (minutes) <span className="text-[#9b9b9b] font-normal">(optional)</span></Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="e.g. 8"
                    value={durationMin}
                    onChange={e => setDurationMin(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Transcript <span className="text-red-500">*</span></Label>
                <Textarea
                  rows={16}
                  placeholder={`Agent: Thank you for calling collections, this is Maria. May I speak with John Smith?\nCustomer: This is John.\nAgent: Hi John, I'm calling regarding your account ending in 4521 with ABC Collections...\n...`}
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  className="font-mono text-xs resize-none"
                />
                <p className="text-xs text-[#9b9b9b]">{transcript.length} chars — the AI processes up to 8,000 characters</p>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-[#f8f8f8] border border-[#efefef] p-3.5">
                <ShieldAlert className="h-4 w-4 text-[#9b9b9b] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-[#555] font-medium mb-0.5">AI auditor uses your active QA Rules</p>
                  <p className="text-xs text-[#9b9b9b]">
                    Configure rules in the QA Rules tab to customize what gets flagged — required disclosures,
                    prohibited phrases, quality criteria, regulation references (FDCPA, TCPA, GDPR…).
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !agentName.trim() || transcript.trim().length < 20}
                  className="gap-2"
                >
                  {submitting
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Uploading &amp; Analyzing…</>
                    : <><PlayCircle className="h-4 w-4" />Upload &amp; Analyze</>}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setAgentName(''); setAgentId(''); setTranscript(''); setDurationMin(''); setChannel('call'); }}
                  disabled={submitting}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── QA RULES ───────────────────────────────────────────────── */}
        <TabsContent value="rules" className="pt-4">
          <QACRulesManager />
        </TabsContent>

        {/* ── COMPLIANCE RULES ───────────────────────────────────────── */}
        <TabsContent value="compliance" className="pt-4">
          <CompliancePanel />
        </TabsContent>

        {/* ── AGENT MONITORING ───────────────────────────────────────── */}
        <TabsContent value="monitoring" className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[#111]">Agent Monitoring Dashboard</h3>
              <p className="text-xs text-[#6b6b6b] mt-0.5">Performance breakdown per agent — sorted by lowest score first</p>
            </div>
            <span className="text-xs text-[#9b9b9b]">{agentStats.length} agent{agentStats.length !== 1 ? 's' : ''}</span>
          </div>
          <Card>
            <CardContent className="p-0">
              {agentStats.length === 0 ? (
                <div className="py-16 text-center">
                  <Users2 className="h-8 w-8 text-[#e0e0e0] mx-auto mb-3" />
                  <p className="text-sm text-[#555] font-medium">No agent data yet</p>
                  <p className="text-xs text-[#9b9b9b] mt-1">Analyze interactions first to see agent-level metrics.</p>
                </div>
              ) : (
                <div>
                  <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-2.5 border-b border-[#f0f0f0] text-[10px] font-semibold text-[#9b9b9b] uppercase tracking-wider">
                    <span>Agent</span>
                    <span className="text-right">Interactions</span>
                    <span className="text-right">Avg Score</span>
                    <span className="text-right">Pass Rate</span>
                    <span className="text-right">Flagged</span>
                    <span className="text-right">Score Bar</span>
                  </div>
                  <div className="divide-y divide-[#f5f5f5]">
                    {agentStats.map((agent, idx) => (
                      <div key={agent.name} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 items-center px-5 py-3 hover:bg-[#fafafa] transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[10px] font-bold text-[#c0c0c0] w-4 shrink-0">{idx + 1}</span>
                          <div className="h-7 w-7 rounded-full bg-[#f0f0f0] flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-[#555]">{agent.name.slice(0, 2).toUpperCase()}</span>
                          </div>
                          <span className="text-sm font-semibold text-[#111] truncate">{agent.name}</span>
                        </div>
                        <span className="text-sm text-[#555] text-right">{agent.count}</span>
                        <span className={`text-sm font-bold text-right ${
                          agent.avgScore === null ? 'text-[#c0c0c0]' :
                          agent.avgScore >= 80 ? 'text-green-600' :
                          agent.avgScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {agent.avgScore !== null ? `${agent.avgScore}%` : '—'}
                        </span>
                        <span className={`text-sm text-right ${
                          agent.passRate === null ? 'text-[#c0c0c0]' :
                          agent.passRate >= 80 ? 'text-green-600' :
                          agent.passRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {agent.passRate !== null ? `${agent.passRate}%` : '—'}
                        </span>
                        <span className={`text-sm text-right ${agent.flagged > 0 ? 'text-red-600 font-semibold' : 'text-[#9b9b9b]'}`}>
                          {agent.flagged > 0 ? `⚑ ${agent.flagged}` : '—'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                (agent.avgScore ?? 0) >= 80 ? 'bg-green-500' :
                                (agent.avgScore ?? 0) >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${agent.avgScore ?? 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── INTEGRATIONS ───────────────────────────────────────────── */}
        <TabsContent value="integrations" className="pt-4">
          <QACIntegrationsPanel />
        </TabsContent>

        {/* ── DEVELOPER DOCS ─────────────────────────────────────────── */}
        <TabsContent value="docs" className="pt-4">
          <QACDocsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Integrations Panel ───────────────────────────────────────────────────────

interface QACIntegrationConfig {
  id: string;
  webhook_token: string;
  twilio_account_sid: string | null;
  auto_analyze: boolean;
  agent_name_field: string;
  is_active: boolean;
  provider_name: string | null;
  field_mappings: Record<string, string[]> | null;
}

const DEFAULT_FIELD_MAPPINGS: Record<string, string[]> = {
  recording_url:  ['RecordingUrl', 'recording_url', 'audioUrl', 'audio_url', 'recordingUrl', 'file_url'],
  agent_name:     ['agent_name', 'To', 'user_name', 'extension', 'sip_user', 'called_number'],
  customer_phone: ['From', 'caller_id', 'customer_phone', 'ani', 'calling_number'],
  call_id:        ['CallSid', 'call_id', 'callId', 'session_id', 'external_call_id', 'call_uuid'],
  duration:       ['RecordingDuration', 'duration', 'call_duration', 'callDuration', 'duration_seconds'],
  transcript:     ['transcript', 'transcription', 'text', 'call_transcript'],
  agent_id:       ['agent_id', 'user_id', 'extension_id', 'sip_user_id'],
  direction:      ['direction', 'call_direction', 'callDirection', 'call_type'],
  outcome:        ['outcome', 'call_outcome', 'disposition', 'hangup_cause'],
  language:       ['language', 'lang', 'transcript_lang'],
  customer_name:  ['customer_name', 'contact_name', 'callerName'],
};

const PROVIDER_PRESETS: Record<string, Record<string, string[]>> = {
  twilio: {
    recording_url:  ['RecordingUrl'],
    agent_name:     ['To'],
    customer_phone: ['From'],
    call_id:        ['CallSid'],
    duration:       ['RecordingDuration'],
  },
  squaretalk: {
    recording_url:  ['recording_url', 'audio_url', 'file_url'],
    agent_name:     ['agent_name', 'user_name', 'extension'],
    customer_phone: ['caller_id', 'from_number', 'ani'],
    call_id:        ['call_id', 'call_uuid', 'session_id'],
    duration:       ['duration', 'call_duration'],
    direction:      ['direction', 'call_type'],
    outcome:        ['outcome', 'disposition'],
  },
  voiso: {
    recording_url:  ['recording_url', 'audioUrl', 'recordingUrl'],
    agent_name:     ['agent', 'agent_name', 'operator'],
    customer_phone: ['customer_phone', 'caller', 'from'],
    call_id:        ['call_id', 'callId'],
    duration:       ['duration', 'billsec'],
    direction:      ['direction'],
    outcome:        ['disposition', 'outcome'],
  },
  genesys: {
    recording_url:  ['mediaUrl', 'recording_url'],
    agent_name:     ['participantName', 'agentName', 'agent_name'],
    customer_phone: ['ani', 'caller_id', 'from'],
    call_id:        ['conversationId', 'call_id'],
    duration:       ['duration', 'talkTime'],
    direction:      ['direction'],
    outcome:        ['wrapUpCode', 'disposition'],
  },
};

function QACIntegrationsPanel() {
  const [config,    setConfig]    = useState<QACIntegrationConfig | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [accountSid, setAccountSid] = useState('');
  const [authToken,  setAuthToken]  = useState('');
  const [showToken,  setShowToken]  = useState(false);

  // Field mapping editor state — keyed by VoiceOS field, value is comma-separated candidates
  const [mappingDraft, setMappingDraft] = useState<Record<string, string>>({});
  const [savingMappings, setSavingMappings] = useState(false);
  const [showMappings, setShowMappings] = useState(false);
  const [providerName, setProviderName] = useState('');
  const [testPayload, setTestPayload] = useState('');
  const [testResult, setTestResult] = useState<Record<string, string | null> | null>(null);

  useEffect(() => {
    fetch('/api/qac/integrations')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: QACIntegrationConfig) => {
        setConfig(d);
        setAccountSid(d.twilio_account_sid ?? '');
        setProviderName(d.provider_name ?? '');
        // Initialise mapping draft from saved config (merge with defaults)
        const merged = { ...DEFAULT_FIELD_MAPPINGS, ...(d.field_mappings ?? {}) };
        const draft: Record<string, string> = {};
        for (const [k, v] of Object.entries(merged)) draft[k] = (v as string[]).join(', ');
        setMappingDraft(draft);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const webhookUrl = config
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/qac/webhooks/${config.webhook_token}`
    : '';

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/qac/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twilio_account_sid: accountSid.trim() || null,
          twilio_auth_token:  authToken.trim()  || null,
          auto_analyze:       config?.auto_analyze ?? true,
          agent_name_field:   config?.agent_name_field ?? 'To',
          provider_name:      providerName.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      const updated = await res.json() as QACIntegrationConfig;
      setConfig(updated);
      setAuthToken('');
      toast.success('Integration settings saved');
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  async function saveMappings() {
    setSavingMappings(true);
    try {
      // Convert draft strings back to arrays
      const mappings: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(mappingDraft)) {
        mappings[k] = v.split(',').map(s => s.trim()).filter(Boolean);
      }
      const res = await fetch('/api/qac/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field_mappings: mappings }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      const updated = await res.json() as QACIntegrationConfig;
      setConfig(updated);
      toast.success('Field mappings saved');
    } catch (e) { toast.error(String(e)); }
    finally { setSavingMappings(false); }
  }

  function loadPreset(provider: string) {
    const preset = PROVIDER_PRESETS[provider];
    if (!preset) return;
    const merged = { ...DEFAULT_FIELD_MAPPINGS, ...preset };
    const draft: Record<string, string> = {};
    for (const [k, v] of Object.entries(merged)) draft[k] = (v as string[]).join(', ');
    setMappingDraft(draft);
    setProviderName(provider);
    toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} preset loaded — click Save Mappings to apply`);
  }

  function runTestExtraction() {
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(testPayload) as Record<string, unknown>; }
    catch { toast.error('Invalid JSON in test payload'); return; }

    const result: Record<string, string | null> = {};
    for (const field of Object.keys(DEFAULT_FIELD_MAPPINGS)) {
      const candidates = mappingDraft[field]
        ? mappingDraft[field]!.split(',').map(s => s.trim()).filter(Boolean)
        : DEFAULT_FIELD_MAPPINGS[field] ?? [];
      let found: string | null = null;
      for (const key of candidates) {
        const val = payload[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          found = String(val).trim();
          break;
        }
      }
      result[field] = found;
    }
    setTestResult(result);
  }

  function copyUrl() {
    void navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied');
  }

  if (loading) return <div className="h-64 bg-[#f5f5f5] rounded-xl animate-pulse" />;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-[#111]">Integrations</h3>
        <p className="text-xs text-[#6b6b6b] mt-0.5">
          Connect your call center platform to automatically ingest recordings and trigger QA analysis.
        </p>
      </div>

      {/* Webhook URL card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-[#111] flex items-center justify-center">
              <Globe className="h-3.5 w-3.5 text-white" />
            </div>
            Webhook URL
          </CardTitle>
          <CardDescription>
            Configure this URL as the Recording Status Callback in your Twilio number or campaign settings.
            When a call recording is ready, Twilio will POST to this endpoint and QA analysis starts automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-[#f5f5f5] border border-[#e8e8e8] px-3 py-2.5 text-xs font-mono text-[#111] break-all">
              {webhookUrl}
            </code>
            <Button size="sm" variant="outline" onClick={copyUrl} className="shrink-0 gap-1.5">
              <Copy className="h-3.5 w-3.5" />Copy
            </Button>
          </div>
          <div className="flex gap-2 rounded-xl bg-[#f8f8f8] border border-[#efefef] p-3">
            <div className="space-y-1 text-xs text-[#6b6b6b]">
              <p className="font-semibold text-[#555]">How to configure in Twilio:</p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Go to Twilio Console → Phone Numbers → Active Numbers</li>
                <li>Select the number your agents use</li>
                <li>Under <strong>Voice &amp; Fax</strong> → <strong>Call Status Changes</strong>, paste this URL</li>
                <li>Enable <strong>Record Calls</strong> in your TwiML or number settings</li>
              </ol>
              <p className="pt-1">Alternatively, set <code className="bg-[#f0f0f0] px-1 rounded">RecordingStatusCallback</code> in your TwiML &lt;Record&gt; verb.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Twilio credentials */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Twilio Credentials</CardTitle>
          <CardDescription>
            Required to download protected recordings. Leave blank if your recordings are publicly accessible.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Account SID</Label>
              <Input
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={accountSid}
                onChange={e => setAccountSid(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Auth Token {config?.twilio_account_sid && <span className="text-green-600 font-normal text-[10px] ml-1">● saved</span>}</Label>
              <div className="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder={config?.twilio_account_sid ? '••••••••••• (leave blank to keep existing)' : 'Your Twilio Auth Token'}
                  value={authToken}
                  onChange={e => setAuthToken(e.target.value)}
                  className="font-mono text-xs pr-16"
                />
                <button
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#9b9b9b] font-medium"
                  onClick={() => setShowToken(s => !s)}
                >
                  {showToken ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Switch
              checked={config?.auto_analyze ?? true}
              onCheckedChange={v => setConfig(c => c ? { ...c, auto_analyze: v } : c)}
            />
            <div>
              <Label>Auto-analyze recordings</Label>
              <p className="text-xs text-[#9b9b9b] mt-0.5">QA analysis starts immediately when a recording arrives</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Agent Name Source <span className="text-[#9b9b9b] font-normal">(Twilio legacy)</span></Label>
              <Select
                value={config?.agent_name_field ?? 'To'}
                onValueChange={v => setConfig(c => c ? { ...c, agent_name_field: v } : c)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="To">To number (destination — agent's line)</SelectItem>
                  <SelectItem value="From">From number (caller)</SelectItem>
                  <SelectItem value="CallSid">Call SID</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-[#9b9b9b]">Fallback when field_mappings has no agent_name match</p>
            </div>

            <div className="space-y-1.5">
              <Label>Provider Name</Label>
              <Input
                placeholder="e.g. Squaretalk, Voiso, Twilio…"
                value={providerName}
                onChange={e => setProviderName(e.target.value)}
                className="text-xs"
              />
              <p className="text-xs text-[#9b9b9b]">Label shown in interaction metadata for traceability</p>
            </div>
          </div>

          <Button onClick={save} disabled={saving} size="sm" className="gap-2">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* Field Mapping Engine */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Field Mapping Engine</CardTitle>
              <CardDescription className="mt-0.5">
                Map your SIP provider's payload keys to VoiceOS fields. Each row is an ordered list of candidates —
                the first non-empty match wins. Works with Twilio, Squaretalk, Voiso, Genesys, and any custom SIP trunk.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowMappings(s => !s)}
              className="shrink-0 gap-1.5"
            >
              {showMappings ? <><X className="h-3.5 w-3.5" />Close</> : 'Configure Mappings'}
            </Button>
          </div>
        </CardHeader>

        {showMappings && (
          <CardContent className="space-y-4">
            {/* Provider presets */}
            <div>
              <p className="text-[10px] font-semibold text-[#9b9b9b] uppercase tracking-widest mb-2">Load Preset</p>
              <div className="flex gap-2 flex-wrap">
                {Object.keys(PROVIDER_PRESETS).map(p => (
                  <button
                    key={p}
                    onClick={() => loadPreset(p)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e0e0e0] bg-white hover:bg-[#f5f5f5] hover:border-[#111] transition-colors capitalize"
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const draft: Record<string, string> = {};
                    for (const [k, v] of Object.entries(DEFAULT_FIELD_MAPPINGS)) draft[k] = v.join(', ');
                    setMappingDraft(draft);
                    toast.success('Reset to default mappings');
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-[#e0e0e0] text-[#9b9b9b] hover:text-[#111] hover:border-[#111] transition-colors"
                >
                  Reset to defaults
                </button>
              </div>
            </div>

            {/* Field mapping rows */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-[#9b9b9b] uppercase tracking-widest">Field Mappings</p>
              <div className="rounded-xl border border-[#efefef] overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#fafafa] border-b border-[#efefef]">
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider w-36">VoiceOS Field</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">Candidate Keys (comma-separated, first match wins)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f5f5f5]">
                    {Object.keys(DEFAULT_FIELD_MAPPINGS).map(field => (
                      <tr key={field}>
                        <td className="px-3 py-2">
                          <code className="text-[11px] font-mono font-semibold text-[#555]">{field}</code>
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            className="w-full h-7 rounded border border-[#e8e8e8] bg-white px-2.5 text-xs font-mono text-[#333] focus:outline-none focus:ring-1 focus:ring-[#111] focus:border-[#111]"
                            value={mappingDraft[field] ?? ''}
                            onChange={e => setMappingDraft(d => ({ ...d, [field]: e.target.value }))}
                            placeholder={DEFAULT_FIELD_MAPPINGS[field]?.join(', ') ?? ''}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button onClick={saveMappings} disabled={savingMappings} size="sm" className="gap-2">
                {savingMappings && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Mappings
              </Button>
            </div>

            {/* Test extractor */}
            <div className="space-y-2 pt-2 border-t border-[#f0f0f0]">
              <p className="text-[10px] font-semibold text-[#9b9b9b] uppercase tracking-widest">Test Payload Extractor</p>
              <p className="text-xs text-[#6b6b6b]">
                Paste a sample webhook payload from your provider and see which VoiceOS fields would be extracted.
              </p>
              <Textarea
                rows={5}
                placeholder={'{\n  "RecordingUrl": "https://…",\n  "From": "+1234567890",\n  "To": "+0987654321",\n  "CallSid": "CAxxxxxxxx",\n  "RecordingDuration": "95"\n}'}
                className="font-mono text-xs"
                value={testPayload}
                onChange={e => setTestPayload(e.target.value)}
              />
              <Button size="sm" variant="outline" onClick={runTestExtraction} className="gap-1.5">
                Run Extraction Test
              </Button>

              {testResult && (
                <div className="rounded-xl border border-[#efefef] overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#fafafa] border-b border-[#efefef]">
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider w-36">Field</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">Extracted Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f5f5f5]">
                      {Object.entries(testResult).map(([field, val]) => (
                        <tr key={field}>
                          <td className="px-3 py-2">
                            <code className="text-[11px] font-mono text-[#555]">{field}</code>
                          </td>
                          <td className="px-3 py-2">
                            {val !== null
                              ? <span className="text-xs font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">{val}</span>
                              : <span className="text-[10px] text-[#c0c0c0] italic">not found</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Webhook URL card - platform instructions */}
      <Card className="border-dashed border-[#e0e0e0]">
        <CardContent className="py-4 px-5">
          <p className="text-xs font-semibold text-[#555] mb-2">Platform Setup Guides</p>
          <div className="grid grid-cols-2 gap-3 text-xs text-[#6b6b6b]">
            <div>
              <p className="font-medium text-[#333] mb-1">Squaretalk</p>
              <p>Settings → Webhooks → Call Events → paste webhook URL. Use &ldquo;Squaretalk&rdquo; preset above.</p>
            </div>
            <div>
              <p className="font-medium text-[#333] mb-1">Voiso</p>
              <p>Settings → Integrations → Webhooks → Call Completed. Use &ldquo;Voiso&rdquo; preset above.</p>
            </div>
            <div>
              <p className="font-medium text-[#333] mb-1">Twilio</p>
              <p>Phone Numbers → Recording Status Callback. Default mappings work out of the box.</p>
            </div>
            <div>
              <p className="font-medium text-[#333] mb-1">Custom SIP / Other</p>
              <p>Send any JSON or form-encoded POST. Map your field names using the editor above.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Developer Docs Panel ─────────────────────────────────────────────────────

function DocSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#fafafa] transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0f0f0] shrink-0">{icon}</span>
        <span className="flex-1 text-sm font-semibold text-[#111]">{title}</span>
        <ChevronDown className={`h-4 w-4 text-[#9b9b9b] transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <CardContent className="pt-0 pb-5 px-5">{children}</CardContent>}
    </Card>
  );
}

function CodeBlock({ code, lang = 'json' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(code).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="relative group rounded-xl bg-[#0f0f0f] border border-[#222] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#222]">
        <span className="text-[10px] font-mono text-[#555] uppercase tracking-widest">{lang}</span>
        <button onClick={copy} className="flex items-center gap-1 text-[10px] text-[#555] hover:text-white transition-colors">
          {copied ? <CheckCircle2 className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[11.5px] leading-relaxed text-[#d4d4d4] font-mono whitespace-pre">{code}</pre>
    </div>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#111] text-[10px] font-bold text-white shrink-0">{n}</span>
  );
}

function QACDocsPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-[#111]">Developer Documentation</h3>
        <p className="text-xs text-[#6b6b6b] mt-0.5">
          Everything you need to integrate any SIP trunk or VoIP platform with the QA Center.
        </p>
      </div>

      {/* ── Quick Start ─────────────────────────────────────────────── */}
      <DocSection title="Quick Start — 3 steps" icon={<Zap className="h-4 w-4 text-[#111]" />}>
        <ol className="space-y-4 mt-2">
          {[
            {
              n: 1,
              title: 'Copy your Webhook URL',
              body: 'Go to QA Center → Integrations tab. Copy the unique webhook URL shown there. It looks like:',
              code: 'POST https://your-app.vercel.app/api/qac/webhooks/{TOKEN}',
              lang: 'bash',
            },
            {
              n: 2,
              title: 'Configure your SIP trunk provider',
              body: 'Paste the URL as the "call completed" or "recording ready" callback in your provider settings. See the Provider Guides section below for exact steps per platform.',
            },
            {
              n: 3,
              title: 'Enable Auto-Analyze',
              body: 'In the Integrations tab, turn on Auto-analyze recordings. Every incoming call will be transcribed (if needed) and scored automatically within seconds of the call ending.',
            },
          ].map(({ n, title, body, code, lang }) => (
            <li key={n} className="flex gap-3">
              <StepBadge n={n} />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-semibold text-[#111]">{title}</p>
                <p className="text-xs text-[#6b6b6b]">{body}</p>
                {code && <CodeBlock code={code} lang={lang} />}
              </div>
            </li>
          ))}
        </ol>
      </DocSection>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <DocSection title="Architecture — How it works" icon={<Activity className="h-4 w-4 text-[#111]" />}>
        <CodeBlock lang="flow" code={`SIP Trunk / VoIP Provider
        │
        │  POST /api/qac/webhooks/{TOKEN}
        │  Body: JSON or form-encoded with call data
        │
        ▼
┌─────────────────────────────────────────────┐
│         VoiceOS Webhook Receiver            │
│                                             │
│  1. Authenticate via TOKEN in URL           │
│  2. Flatten nested payload                  │
│  3. Extract fields via mapping engine:      │
│     recording_url, agent_name, transcript…  │
│  4. INSERT into qac_interactions            │
│                                             │
│  If transcript missing AND recording_url    │
│  present:                                   │
│    → Download audio from provider           │
│    → Transcribe with Groq Whisper           │
│    → Save transcript to DB                  │
│                                             │
│  If auto_analyze = true:                    │
│    → POST /api/qac/interactions/{id}/analyze│
│    → AI scores 5 criteria (0–100)           │
│    → Detects compliance flags               │
│    → Generates coaching notes              │
└─────────────────────────────────────────────┘
        │
        ▼
   QA Center Dashboard
   Interactions list, scores, flags, reports`} />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Authentication', desc: 'Token in URL — no extra headers needed' },
            { label: 'Transcription', desc: 'Groq Whisper (auto) — requires GROQ_API_KEY env var' },
            { label: 'Analysis', desc: 'Claude AI against your active QA Rules — instant scoring' },
          ].map(({ label, desc }) => (
            <div key={label} className="rounded-xl bg-[#fafafa] border border-[#f0f0f0] p-3">
              <p className="text-xs font-semibold text-[#111] mb-1">{label}</p>
              <p className="text-[11px] text-[#6b6b6b]">{desc}</p>
            </div>
          ))}
        </div>
      </DocSection>

      {/* ── Endpoint reference ────────────────────────────────────────── */}
      <DocSection title="Endpoint Reference" icon={<Code2 className="h-4 w-4 text-[#111]" />}>
        <div className="space-y-4 mt-1">
          <div className="rounded-xl border border-[#e0e0e0] overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-[#fafafa] border-b border-[#e0e0e0]">
              <span className="rounded bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5">POST</span>
              <code className="text-xs font-mono text-[#111]">/api/qac/webhooks/<span className="text-blue-600">{'{TOKEN}'}</span></code>
            </div>
            <div className="px-4 py-3 space-y-3 text-xs text-[#555]">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div><span className="font-semibold text-[#333]">Auth</span><br />TOKEN in URL path (from Integrations tab)</div>
                <div><span className="font-semibold text-[#333]">Content-Type</span><br /><code className="bg-[#f0f0f0] px-1 rounded">application/json</code> or <code className="bg-[#f0f0f0] px-1 rounded">application/x-www-form-urlencoded</code></div>
                <div><span className="font-semibold text-[#333]">Response (success)</span><br /><code className="bg-[#f0f0f0] px-1 rounded">202 Accepted</code> — analysis runs async</div>
                <div><span className="font-semibold text-[#333]">Response (error)</span><br /><code className="bg-[#f0f0f0] px-1 rounded">404</code> invalid token · <code className="bg-[#f0f0f0] px-1 rounded">400</code> bad body</div>
              </div>
            </div>
          </div>

          <p className="text-xs font-semibold text-[#333]">Minimum required fields</p>
          <p className="text-xs text-[#6b6b6b]">You must send at least one of: <code className="bg-[#f0f0f0] px-1 rounded">transcript</code> (text) or <code className="bg-[#f0f0f0] px-1 rounded">recording_url</code> (audio URL). Everything else is optional but improves data quality.</p>

          <CodeBlock lang="json — minimal payload" code={`{
  "recording_url": "https://api.twilio.com/recordings/RE123.mp3",
  "agent_name": "Maria Garcia",
  "call_id": "CA0000xxxx"
}`} />

          <CodeBlock lang="json — full payload" code={`{
  "recording_url": "https://cdn.provider.com/recordings/abc123.mp3",
  "transcript":    "Agent: Thank you for calling...",
  "agent_name":    "Maria Garcia",
  "agent_id":      "EMP-0042",
  "customer_phone": "+15551234567",
  "customer_name":  "John Smith",
  "call_id":        "call_uuid_abc123",
  "duration":       "245",
  "direction":      "inbound",
  "outcome":        "resolved",
  "language":       "en"
}`} />
        </div>
      </DocSection>

      {/* ── Provider guides ───────────────────────────────────────────── */}
      <DocSection title="Provider Setup Guides" icon={<Globe className="h-4 w-4 text-[#111]" />}>
        <div className="space-y-6 mt-1">

          {/* Twilio */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#f22f46] text-white text-[10px] font-bold px-2 py-0.5">Twilio</span>
              <span className="text-xs text-[#9b9b9b]">Default mappings work out of the box</span>
            </div>
            <ol className="space-y-1.5 text-xs text-[#555] list-decimal pl-4">
              <li>Twilio Console → <strong>Phone Numbers</strong> → <strong>Manage</strong> → <strong>Active Numbers</strong></li>
              <li>Click your number → scroll to <strong>Voice Configuration</strong></li>
              <li>Under <strong>Call Status Changes</strong> paste your webhook URL</li>
              <li>Enable <strong>Record calls</strong> → set <strong>Recording Status Callback</strong> to the same URL</li>
            </ol>
            <CodeBlock lang="twilio payload (sent automatically)" code={`{
  "CallSid":           "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "RecordingUrl":      "https://api.twilio.com/2010-04-01/Accounts/.../Recordings/RExx",
  "RecordingDuration": "120",
  "From":              "+15551234567",
  "To":                "+15559876543",
  "CallStatus":        "completed"
}`} />
          </div>

          {/* Squaretalk */}
          <div className="space-y-3 border-t border-[#f0f0f0] pt-5">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#5b45d5] text-white text-[10px] font-bold px-2 py-0.5">Squaretalk</span>
              <span className="text-xs text-[#9b9b9b]">Use the Squaretalk preset in Integrations tab</span>
            </div>
            <ol className="space-y-1.5 text-xs text-[#555] list-decimal pl-4">
              <li>Squaretalk Admin → <strong>Settings</strong> → <strong>Webhooks</strong></li>
              <li>Add webhook → Event: <strong>call.completed</strong></li>
              <li>Paste your webhook URL → Save</li>
              <li>In VoiceOS Integrations tab, click <strong>Load Squaretalk preset</strong></li>
            </ol>
            <CodeBlock lang="squaretalk payload example" code={`{
  "call_id":       "abc-123-xyz",
  "agent_name":    "maria.garcia",
  "caller_id":     "+15551234567",
  "recording_url": "https://cdn.squaretalk.com/recordings/abc123.mp3",
  "duration":      245,
  "direction":     "inbound",
  "disposition":   "answered"
}`} />
          </div>

          {/* Voiso */}
          <div className="space-y-3 border-t border-[#f0f0f0] pt-5">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#00b4d8] text-white text-[10px] font-bold px-2 py-0.5">Voiso</span>
              <span className="text-xs text-[#9b9b9b]">Use the Voiso preset in Integrations tab</span>
            </div>
            <ol className="space-y-1.5 text-xs text-[#555] list-decimal pl-4">
              <li>Voiso Dashboard → <strong>Settings</strong> → <strong>Integrations</strong> → <strong>Webhooks</strong></li>
              <li>Create webhook → Event: <strong>Call Completed</strong></li>
              <li>Paste your webhook URL → Save</li>
              <li>In VoiceOS Integrations tab, click <strong>Load Voiso preset</strong></li>
            </ol>
            <CodeBlock lang="voiso payload example" code={`{
  "call_id":       "voiso_call_9876",
  "agent":         "agent@company.com",
  "customer_phone": "+15551234567",
  "audioUrl":      "https://recordings.voiso.com/9876.mp3",
  "billsec":       180,
  "direction":     "inbound",
  "disposition":   "ANSWERED"
}`} />
          </div>

          {/* Custom / Generic */}
          <div className="space-y-3 border-t border-[#f0f0f0] pt-5">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#555] text-white text-[10px] font-bold px-2 py-0.5">Custom SIP / Generic</span>
            </div>
            <p className="text-xs text-[#555]">
              Send a <code className="bg-[#f0f0f0] px-1 rounded">POST</code> with any field names and use the <strong>Field Mapping Engine</strong> in the Integrations tab to tell VoiceOS which key maps to which concept. Supports nested JSON (dot-notation) and form-encoded bodies.
            </p>
            <CodeBlock lang="curl example" code={`curl -X POST "https://your-app.vercel.app/api/qac/webhooks/YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "my_recording": "https://cdn.myapp.com/call_123.mp3",
    "operator":     "Maria Garcia",
    "src_number":   "+15551234567",
    "uniqueid":     "call_123",
    "billsec":      "245"
  }'`} />
            <p className="text-xs text-[#6b6b6b]">
              Then in the Field Mapping Engine, set <code className="bg-[#f0f0f0] px-1 rounded">recording_url</code> candidates to <code className="bg-[#f0f0f0] px-1 rounded">my_recording</code> and <code className="bg-[#f0f0f0] px-1 rounded">agent_name</code> to <code className="bg-[#f0f0f0] px-1 rounded">operator</code>.
            </p>
          </div>
        </div>
      </DocSection>

      {/* ── Field reference ───────────────────────────────────────────── */}
      <DocSection title="Field Mapping Reference" icon={<Settings2 className="h-4 w-4 text-[#111]" />}>
        <p className="text-xs text-[#6b6b6b] mb-3 mt-1">
          These are the VoiceOS internal fields. For each one you can configure which keys from your provider's payload to look at (ordered — first non-empty match wins).
        </p>
        <div className="rounded-xl border border-[#e0e0e0] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#fafafa] border-b border-[#e0e0e0]">
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">Field</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">Type</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">Required</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0] text-xs">
              {[
                { field: 'recording_url', type: 'string (URL)', req: true,  desc: 'Audio file URL. If transcript is missing, this is downloaded and transcribed via Groq Whisper.' },
                { field: 'transcript',    type: 'string',       req: true,  desc: 'Plain text transcript of the call. If provided, skips audio transcription.' },
                { field: 'agent_name',    type: 'string',       req: false, desc: 'Human-readable agent name shown in the QA Center.' },
                { field: 'agent_id',      type: 'string',       req: false, desc: 'Internal agent ID (e.g. employee number, extension).' },
                { field: 'customer_phone',type: 'string',       req: false, desc: "Customer's phone number in E.164 or local format." },
                { field: 'customer_name', type: 'string',       req: false, desc: 'Customer name if available (CRM lookup, etc.).' },
                { field: 'call_id',       type: 'string',       req: false, desc: 'Your platform call UUID — used for deduplication.' },
                { field: 'duration',      type: 'number (s)',   req: false, desc: 'Call duration in seconds.' },
                { field: 'direction',     type: 'inbound|outbound', req: false, desc: 'Call direction.' },
                { field: 'outcome',       type: 'string',       req: false, desc: 'Call disposition (answered, resolved, transferred…).' },
                { field: 'language',      type: 'ISO 639-1',    req: false, desc: 'Language hint for Whisper transcription (e.g. en, es, fr). Defaults to en.' },
              ].map(({ field, type, req, desc }) => (
                <tr key={field} className="hover:bg-[#fafafa]">
                  <td className="px-4 py-2.5"><code className="font-mono text-[11px] text-[#111]">{field}</code></td>
                  <td className="px-4 py-2.5 text-[#6b6b6b] font-mono text-[10px]">{type}</td>
                  <td className="px-4 py-2.5">
                    {req
                      ? <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">one of *</span>
                      : <span className="text-[10px] text-[#c0c0c0]">optional</span>}
                  </td>
                  <td className="px-4 py-2.5 text-[#555]">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2.5 bg-[#fafafa] border-t border-[#e0e0e0]">
            <p className="text-[10px] text-[#9b9b9b]">* At least one of <code className="bg-[#f0f0f0] px-1 rounded">recording_url</code> or <code className="bg-[#f0f0f0] px-1 rounded">transcript</code> must be present. All other fields are optional.</p>
          </div>
        </div>
      </DocSection>

      {/* ── Manual REST API ───────────────────────────────────────────── */}
      <DocSection title="Manual REST API (direct integration)" icon={<Code2 className="h-4 w-4 text-[#111]" />}>
        <p className="text-xs text-[#6b6b6b] mt-1 mb-3">
          If you prefer to create interactions programmatically (e.g. from your own backend), use the interactions API directly with your workspace API key.
        </p>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#333]">1. Create an interaction</p>
          <CodeBlock lang="curl" code={`curl -X POST "https://your-app.vercel.app/api/qac/interactions" \\
  -H "Authorization: Bearer vos_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_name": "Maria Garcia",
    "agent_id":   "EMP-0042",
    "channel":    "call",
    "transcript": "Agent: Thank you for calling...",
    "duration_s": 245
  }'`} />
          <p className="text-[10px] text-[#9b9b9b]">Returns the interaction object with its <code className="bg-[#f0f0f0] px-1 rounded">id</code>.</p>

          <p className="text-xs font-semibold text-[#333] pt-2">2. Trigger analysis</p>
          <CodeBlock lang="curl" code={`curl -X POST "https://your-app.vercel.app/api/qac/interactions/{INTERACTION_ID}/analyze" \\
  -H "Authorization: Bearer vos_YOUR_API_KEY"`} />
          <p className="text-[10px] text-[#9b9b9b]">Returns the evaluation with <code className="bg-[#f0f0f0] px-1 rounded">overall_score</code>, <code className="bg-[#f0f0f0] px-1 rounded">criteria_scores</code>, flags, and coaching notes.</p>

          <p className="text-xs font-semibold text-[#333] pt-2">3. Retrieve results</p>
          <CodeBlock lang="curl" code={`curl "https://your-app.vercel.app/api/qac/interactions/{INTERACTION_ID}" \\
  -H "Authorization: Bearer vos_YOUR_API_KEY"`} />
        </div>
      </DocSection>

      {/* ── Env vars ─────────────────────────────────────────────────── */}
      <DocSection title="Required Environment Variables" icon={<ShieldAlert className="h-4 w-4 text-[#111]" />}>
        <div className="mt-1 rounded-xl border border-[#e0e0e0] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#fafafa] border-b border-[#e0e0e0]">
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">Variable</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">Required for</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {[
                { key: 'GROQ_API_KEY',          for: 'Audio transcription',   note: 'Free tier at console.groq.com — needed to auto-transcribe recordings' },
                { key: 'ANTHROPIC_API_KEY',      for: 'QA scoring / analysis', note: 'Required for AI scoring. Get at console.anthropic.com' },
                { key: 'INTERNAL_API_SECRET',    for: 'Auto-analyze security', note: 'Any random 32-char hex. Prevents unauthorized calls to the analyze endpoint.' },
                { key: 'NEXT_PUBLIC_APP_URL',    for: 'Correct redirect URLs',  note: 'Your deployed app URL (e.g. https://your-app.vercel.app)' },
              ].map(({ key, for: forStr, note }) => (
                <tr key={key} className="hover:bg-[#fafafa]">
                  <td className="px-4 py-2.5"><code className="font-mono text-[11px] text-[#111]">{key}</code></td>
                  <td className="px-4 py-2.5 text-[#555]">{forStr}</td>
                  <td className="px-4 py-2.5 text-[#9b9b9b]">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocSection>
    </div>
  );
}
