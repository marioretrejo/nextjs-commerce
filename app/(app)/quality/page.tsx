'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Agent, Call, QACriteria } from '@/lib/supabase/types';
import { Shield, TrendingUp, AlertTriangle, Star, Plus, Pencil, Trash2 } from 'lucide-react';
import { FieldTooltip } from '@/components/ui/field-tooltip';
import { format, subDays, eachWeekOfInterval, endOfWeek, startOfDay } from 'date-fns';
import Link from 'next/link';

interface QAWeeklyPoint {
  week: string;
  avg: number;
}

interface AgentQARow {
  agent: Agent;
  avgScore: number;
  callCount: number;
  belowThreshold: number;
}

interface CriteriaForm {
  name: string;
  description: string;
  weight: number;
}

const THRESHOLD = 70;

export default function QualityPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [criteria, setCriteria] = useState<Record<string, QACriteria[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  // Criteria dialog state
  const [criteriaDialogOpen, setCriteriaDialogOpen] = useState(false);
  const [criteriaAgentId, setCriteriaAgentId] = useState<string>('');
  const [editingCriteria, setEditingCriteria] = useState<QACriteria | null>(null);
  const [criteriaForm, setCriteriaForm] = useState<CriteriaForm>({ name: '', description: '', weight: 50 });
  const [savingCriteria, setSavingCriteria] = useState(false);

  const [workspaceId, setWorkspaceId] = useState('');

  useEffect(() => {
    fetch('/api/admin/workspace-id')
      .then((r) => r.json())
      .then((d: { workspace_id: string }) => setWorkspaceId(d.workspace_id ?? ''))
      .catch(() => setLoading(false));
  }, []);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const since = subDays(new Date(), 90).toISOString();
      const [agentsRes, callsRes] = await Promise.all([
        fetch(`/api/agents?workspace_id=${workspaceId}`),
        fetch(`/api/calls?workspace_id=${workspaceId}&since=${since}&limit=1000`),
      ]);
      if (agentsRes.ok) {
        const agentList = await agentsRes.json() as Agent[];
        setAgents(Array.isArray(agentList) ? agentList : []);

        const criteriaMap: Record<string, QACriteria[]> = {};
        await Promise.all((Array.isArray(agentList) ? agentList : []).map(async (a) => {
          const r = await fetch(`/api/agents/${a.id}/criteria`);
          if (r.ok) {
            const cd = await r.json() as QACriteria[];
            criteriaMap[a.id] = Array.isArray(cd) ? cd : [];
          }
        }));
        setCriteria(criteriaMap);
      }
      if (callsRes.ok) {
        const d = await callsRes.json() as { data: Call[] };
        setCalls(d.data ?? []);
      }
    } catch {
      // network error — fall through to setLoading(false)
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { if (workspaceId) fetchData(); }, [fetchData, workspaceId]);


  // Filtered calls
  const filteredCalls = selectedAgent === 'all'
    ? calls
    : calls.filter(c => c.agent_id === selectedAgent);

  const scoredCalls = filteredCalls.filter(c => c.qa_score != null);
  const avgScore = scoredCalls.length > 0
    ? scoredCalls.reduce((s, c) => s + (c.qa_score as number), 0) / scoredCalls.length
    : 0;

  const belowThresholdCalls = scoredCalls.filter(c => (c.qa_score as number) < THRESHOLD);

  // Best agent
  const agentQARows: AgentQARow[] = agents.map((agent) => {
    const ac = calls.filter(c => c.agent_id === agent.id && c.qa_score != null);
    const avg = ac.length > 0 ? ac.reduce((s, c) => s + (c.qa_score as number), 0) / ac.length : 0;
    return {
      agent,
      avgScore: Math.round(avg * 10) / 10,
      callCount: ac.length,
      belowThreshold: ac.filter(c => (c.qa_score as number) < THRESHOLD).length,
    };
  }).filter(r => r.callCount > 0).sort((a, b) => b.avgScore - a.avgScore);

  const bestAgent = agentQARows[0] ?? null;
  const worstCall = scoredCalls.length > 0
    ? scoredCalls.reduce((min, c) => (c.qa_score as number) < (min.qa_score as number) ? c : min)
    : null;

  // Weekly QA trend
  const weekStarts = eachWeekOfInterval({ start: subDays(new Date(), 89), end: new Date() }, { weekStartsOn: 1 });
  const weeklyData: QAWeeklyPoint[] = weekStarts.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const wc = scoredCalls.filter(c => {
      const d = new Date(c.created_at);
      return d >= startOfDay(weekStart) && d <= weekEnd;
    });
    const avg = wc.length > 0 ? wc.reduce((s, c) => s + (c.qa_score as number), 0) / wc.length : 0;
    return { week: format(weekStart, 'MMM d'), avg: Math.round(avg * 10) / 10 };
  });

  function openAddCriteria(agentId: string) {
    setCriteriaAgentId(agentId);
    setEditingCriteria(null);
    setCriteriaForm({ name: '', description: '', weight: 50 });
    setCriteriaDialogOpen(true);
  }

  function openEditCriteria(agentId: string, c: QACriteria) {
    setCriteriaAgentId(agentId);
    setEditingCriteria(c);
    setCriteriaForm({ name: c.name, description: c.description ?? '', weight: c.weight });
    setCriteriaDialogOpen(true);
  }

  async function saveCriteria() {
    if (!criteriaForm.name.trim()) return;
    setSavingCriteria(true);
    const url = `/api/agents/${criteriaAgentId}/criteria`;
    const method = editingCriteria ? 'PATCH' : 'POST';
    const body = editingCriteria
      ? { ...criteriaForm, criteria_id: editingCriteria.id }
      : criteriaForm;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await fetchData();
      setCriteriaDialogOpen(false);
      toast.success(editingCriteria ? 'Criteria updated' : 'Criteria added');
    } else {
      const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
      toast.error(err.error ?? 'Failed to save criteria');
    }
    setSavingCriteria(false);
  }

  async function deleteCriteria(agentId: string, criteriaId: string) {
    await fetch(`/api/agents/${agentId}/criteria?criteria_id=${criteriaId}`, { method: 'DELETE' });
    await fetchData();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Quality Assurance</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">Monitor agent performance and manage QA scoring criteria.</p>
        </div>
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
        >
          <option value="all">All Agents</option>
          {agents.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Avg QA Score',
            value: loading ? '—' : `${avgScore.toFixed(1)}%`,
            icon: <Shield className="w-5 h-5 text-[#6b6b6b]" />,
            sub: `${scoredCalls.length} scored calls`,
          },
          {
            label: 'Best Agent',
            value: loading ? '—' : (bestAgent ? bestAgent.agent.name : '—'),
            icon: <Star className="w-5 h-5 text-[#6b6b6b]" />,
            sub: bestAgent ? `${bestAgent.avgScore}% avg` : 'No data',
          },
          {
            label: 'Worst Call Score',
            value: loading ? '—' : (worstCall ? `${worstCall.qa_score}%` : '—'),
            icon: <TrendingUp className="w-5 h-5 text-[#6b6b6b]" />,
            sub: worstCall ? format(new Date(worstCall.created_at), 'MMM d') : 'No data',
          },
          {
            label: `Below ${THRESHOLD}%`,
            value: loading ? '—' : belowThresholdCalls.length.toString(),
            icon: <AlertTriangle className="w-5 h-5 text-[#6b6b6b]" />,
            sub: 'Calls below threshold',
          },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm text-[#6b6b6b]">{m.label}</p>
                {m.icon}
              </div>
              <p className="text-3xl font-bold text-[#0a0a0a]">{m.value}</p>
              <p className="text-xs text-[#6b6b6b] mt-1">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend chart + agent table */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">QA Score Trend</CardTitle>
            <CardDescription>Average weekly QA score (last 90 days)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-52 bg-[#f5f5f5] rounded animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={weeklyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6b6b6b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b6b6b' }} unit="%" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 12 }}
                    formatter={(v: number) => [`${v}%`, 'Avg QA']}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="#0a0a0a"
                    strokeWidth={2}
                    dot={{ fill: '#0a0a0a', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Agent QA Scores</CardTitle>
            <CardDescription>Per-agent quality performance</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 bg-[#f5f5f5] rounded animate-pulse" />
                ))}
              </div>
            ) : agentQARows.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#6b6b6b]">No QA data available.</div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-3 px-5 py-3 border-b border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
                  <span>Agent</span>
                  <span className="text-right">Calls</span>
                  <span className="text-right">Avg QA</span>
                  <span className="text-right">Below {THRESHOLD}%</span>
                </div>
                <div className="divide-y divide-[#e0e0e0]">
                  {agentQARows.map((row) => (
                    <div key={row.agent.id} className="grid grid-cols-4 gap-3 px-5 py-3 text-sm items-center hover:bg-[#f5f5f5]">
                      <span className="font-medium text-[#0a0a0a] truncate">{row.agent.name}</span>
                      <span className="text-right text-[#6b6b6b]">{row.callCount}</span>
                      <span className="text-right font-medium text-[#0a0a0a]">{row.avgScore}%</span>
                      <span className="text-right">
                        {row.belowThreshold > 0 ? (
                          <Badge className="bg-[#0a0a0a] text-white border-transparent text-xs">
                            {row.belowThreshold}
                          </Badge>
                        ) : (
                          <span className="text-[#6b6b6b]">0</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low-score calls */}
      {belowThresholdCalls.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Low-Score Calls
            </CardTitle>
            <CardDescription>Calls scoring below {THRESHOLD}% — review and address issues.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-[1fr_1fr_1fr_80px_1fr_40px] gap-3 px-5 py-3 border-b border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
              <span>Contact</span>
              <span>Agent</span>
              <span>Outcome</span>
              <span>QA Score</span>
              <span>Date</span>
              <span />
            </div>
            <div className="divide-y divide-[#e0e0e0]">
              {belowThresholdCalls.slice(0, 20).map((call) => (
                <div key={call.id} className="grid grid-cols-[1fr_1fr_1fr_80px_1fr_40px] gap-3 px-5 py-4 text-sm items-center hover:bg-[#f5f5f5]">
                  <span className="text-[#0a0a0a] font-medium">{call.contact_name ?? '—'}</span>
                  <span className="text-[#6b6b6b]">
                    {call.agent ? (call.agent as unknown as { name: string }).name : '—'}
                  </span>
                  <span>
                    <Badge className="border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs">
                      {call.outcome ?? 'unknown'}
                    </Badge>
                  </span>
                  <span className="font-bold text-[#0a0a0a]">{call.qa_score}%</span>
                  <span className="text-[#6b6b6b] text-xs">{format(new Date(call.created_at), 'MMM d, yyyy')}</span>
                  <Link href={`/calls/${call.id}`} className="text-[#6b6b6b] hover:text-[#0a0a0a] text-xs underline">
                    View
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* QA Criteria builder per agent */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[#0a0a0a]">QA Criteria</h2>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-24 bg-[#f5f5f5] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-[#6b6b6b]">
              No agents found. Create an agent to define QA criteria.
            </CardContent>
          </Card>
        ) : (
          agents.map((agent) => {
            const agentCriteria = criteria[agent.id] ?? [];
            return (
              <Card key={agent.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">{agent.name}</CardTitle>
                      <CardDescription>{agentCriteria.length} criteria defined</CardDescription>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openAddCriteria(agent.id)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Criteria
                    </Button>
                  </div>
                </CardHeader>
                {agentCriteria.length > 0 && (
                  <CardContent className="p-0 border-t border-[#e0e0e0]">
                    <div className="divide-y divide-[#e0e0e0]">
                      {agentCriteria.map((c) => (
                        <div key={c.id} className="flex items-center gap-4 px-5 py-3 hover:bg-[#f5f5f5]">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#0a0a0a]">{c.name}</p>
                            {c.description && (
                              <p className="text-xs text-[#6b6b6b] mt-0.5 truncate">{c.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className="border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs">
                              Weight: {c.weight}%
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => openEditCriteria(agent.id, c)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-[#6b6b6b] hover:text-[#0a0a0a]"
                              onClick={() => deleteCriteria(agent.id, c.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Criteria dialog */}
      <Dialog open={criteriaDialogOpen} onOpenChange={setCriteriaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCriteria ? 'Edit Criteria' : 'Add QA Criteria'}</DialogTitle>
            <DialogDescription>
              Define a scoring criterion for call quality evaluation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="criteria-name">Name <FieldTooltip text="A short label for this criterion. Keep it clear and specific, e.g. 'Greeting Quality' or 'Objection Handling'." /></Label>
              <Input
                id="criteria-name"
                placeholder="e.g. Greeting quality"
                value={criteriaForm.name}
                onChange={(e) => setCriteriaForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="criteria-desc">Description <FieldTooltip text="Explain what the AI should evaluate. More detail helps the scoring model apply the criterion consistently across calls." /></Label>
              <Textarea
                id="criteria-desc"
                placeholder="Describe what this criterion evaluates…"
                value={criteriaForm.description}
                onChange={(e) => setCriteriaForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Weight <FieldTooltip text="How much this criterion contributes to the final QA score (0–100). All criteria weights are normalised, so relative proportions matter more than absolute values." /></Label>
                <span className="text-sm font-medium text-[#0a0a0a]">{criteriaForm.weight}%</span>
              </div>
              <Slider
                min={1}
                max={100}
                step={1}
                value={[criteriaForm.weight]}
                onValueChange={([v]) => setCriteriaForm(f => ({ ...f, weight: v ?? f.weight }))}
              />
              <p className="text-xs text-[#6b6b6b]">Relative importance of this criterion in the overall score.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCriteriaDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCriteria} disabled={savingCriteria || !criteriaForm.name.trim()}>
              {savingCriteria ? 'Saving…' : editingCriteria ? 'Save Changes' : 'Add Criteria'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
