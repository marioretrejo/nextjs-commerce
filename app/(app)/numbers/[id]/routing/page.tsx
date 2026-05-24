'use client';

import { use, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface RoutingRule {
  id: string;
  priority: number;
  condition: 'time_of_day' | 'always' | 'caller_id_pattern';
  condition_value?: string;
  agent_id?: string;
}

interface RoutingConfig {
  default_agent_id: string | null;
  rules: RoutingRule[];
}

interface Agent { id: string; name: string }

export default function InboundRoutingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [number, setNumber] = useState('');
  const [inboundEnabled, setInboundEnabled] = useState(false);
  const [config, setConfig] = useState<RoutingConfig>({ default_agent_id: null, rules: [] });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');

  useEffect(() => {
    async function load() {
      const [wsRes, routingRes] = await Promise.all([
        fetch('/api/admin/workspace-id'),
        fetch(`/api/numbers/${id}/routing`),
      ]);
      const wsData = await wsRes.json() as { workspace_id: string };
      setWorkspaceId(wsData.workspace_id ?? '');

      if (routingRes.ok) {
        const d = await routingRes.json() as { number: string; inbound_enabled: boolean; routing_rules: RoutingConfig };
        setNumber(d.number ?? '');
        setInboundEnabled(d.inbound_enabled ?? false);
        setConfig(d.routing_rules ?? { default_agent_id: null, rules: [] });
      }
      setLoading(false);
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/agents?workspace_id=${workspaceId}`)
      .then(r => r.json())
      .then((d: Agent[]) => setAgents(Array.isArray(d) ? d : []));
  }, [workspaceId]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/numbers/${id}/routing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inbound_enabled: inboundEnabled, routing_rules: config }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Routing saved');
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  function addRule() {
    const rule: RoutingRule = {
      id: `rule-${Date.now()}`,
      priority: config.rules.length + 1,
      condition: 'always',
      agent_id: '',
    };
    setConfig(c => ({ ...c, rules: [...c.rules, rule] }));
  }

  function updateRule(ruleId: string, field: string, value: string) {
    setConfig(c => ({
      ...c,
      rules: c.rules.map(r => r.id === ruleId ? { ...r, [field]: value } : r),
    }));
  }

  function removeRule(ruleId: string) {
    setConfig(c => ({ ...c, rules: c.rules.filter(r => r.id !== ruleId) }));
  }

  if (loading) return <div className="p-6"><p className="text-[#6b6b6b]">Loading…</p></div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/numbers">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Inbound Routing</h1>
          <p className="text-sm text-[#6b6b6b] font-mono">{number}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Enable Inbound Calls</CardTitle>
              <CardDescription>Allow this number to receive incoming calls.</CardDescription>
            </div>
            <Switch checked={inboundEnabled} onCheckedChange={setInboundEnabled} />
          </div>
        </CardHeader>
      </Card>

      {inboundEnabled && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Default Agent</CardTitle>
              <CardDescription>Used when no routing rules match.</CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={config.default_agent_id ?? ''}
                onValueChange={v => setConfig(c => ({ ...c, default_agent_id: v || null }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Routing Rules</CardTitle>
                <CardDescription>Rules are evaluated in priority order, top first.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={addRule}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Rule
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.rules.length === 0 ? (
                <p className="text-sm text-[#6b6b6b] text-center py-4">No rules yet. Add a rule above.</p>
              ) : config.rules.map((rule, idx) => (
                <div key={rule.id} className="rounded-lg border border-[#e0e0e0] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#6b6b6b]">Rule {idx + 1}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeRule(rule.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-[#6b6b6b]" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Condition</Label>
                      <Select value={rule.condition} onValueChange={v => updateRule(rule.id, 'condition', v)}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="always">Always</SelectItem>
                          <SelectItem value="time_of_day">Time of Day</SelectItem>
                          <SelectItem value="caller_id_pattern">Caller ID Pattern</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Route to Agent</Label>
                      <Select value={rule.agent_id ?? ''} onValueChange={v => updateRule(rule.id, 'agent_id', v)}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {(rule.condition === 'time_of_day' || rule.condition === 'caller_id_pattern') && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        {rule.condition === 'time_of_day' ? 'Time range (09:00-17:00)' : 'Pattern (e.g. +1800*)'}
                      </Label>
                      <Input
                        className="h-8 text-sm font-mono"
                        value={rule.condition_value ?? ''}
                        onChange={e => updateRule(rule.id, 'condition_value', e.target.value)}
                        placeholder={rule.condition === 'time_of_day' ? '09:00-17:00' : '+1800*'}
                      />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
          Save Routing
        </Button>
      </div>
    </div>
  );
}
