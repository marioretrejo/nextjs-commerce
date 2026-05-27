'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { Agent, AutomationRule } from '@/lib/supabase/types';
import { Loader2, Plus, Trash2, Zap, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { AgentScorecard } from '@/components/agents/agent-scorecard';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const TRIGGER_LABELS: Record<string, string> = {
  any: 'Any outcome',
  converted: 'Converted',
  no_answer: 'No answer',
  voicemail: 'Voicemail',
  rejected: 'Rejected',
  transferred: 'Transferred',
};

const ACTION_LABELS: Record<string, string> = {
  webhook: 'Send Webhook',
  tag_contact: 'Tag Contact',
  send_sms: 'Send SMS',
  notify_team: 'Notify Team',
  add_to_campaign: 'Add to Campaign',
};

const ACTION_COLORS: Record<string, string> = {
  webhook: 'bg-purple-100 text-purple-700',
  tag_contact: 'bg-blue-100 text-blue-700',
  send_sms: 'bg-green-100 text-green-700',
  notify_team: 'bg-orange-100 text-orange-700',
  add_to_campaign: 'bg-pink-100 text-pink-700',
};

interface PhoneNumber { id: string; number: string; status: string }

export function AgentEditForm({ agent, phoneNumbers }: { agent: Agent; phoneNumbers: PhoneNumber[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<Partial<Agent>>(agent);

  const [dynVars, setDynVars] = useState<{ key: string; value: string }[]>(
    Object.entries(agent.dynamic_variables ?? {}).map(([key, value]) => ({ key, value }))
  );

  // Automation state
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [automationLoaded, setAutomationLoaded] = useState(false);
  const [showNewRule, setShowNewRule] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    trigger_outcome: 'converted',
    action_type: 'webhook',
    webhook_url: '',
    tag_name: '',
    sms_message: '',
    notify_email: '',
    campaign_id: '',
  });

  useEffect(() => {
    // Lazy-load automation rules when tab is first accessed
  }, []);

  async function loadAutomation() {
    if (automationLoaded) return;
    const res = await fetch(`/api/agents/${agent.id}/automation`);
    if (res.ok) {
      const data = await res.json() as AutomationRule[];
      setAutomationRules(data);
      setAutomationLoaded(true);
    }
  }

  async function toggleRule(ruleId: string, enabled: boolean) {
    await fetch(`/api/agents/${agent.id}/automation`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_id: ruleId, enabled }),
    });
    setAutomationRules(r => r.map(rule => rule.id === ruleId ? { ...rule, enabled } : rule));
  }

  async function deleteRule(ruleId: string) {
    await fetch(`/api/agents/${agent.id}/automation?rule_id=${ruleId}`, { method: 'DELETE' });
    setAutomationRules(r => r.filter(rule => rule.id !== ruleId));
    toast.success('Rule deleted');
  }

  async function createRule() {
    if (!newRule.name.trim()) { toast.error('Rule name is required'); return; }
    setSavingRule(true);
    try {
      const actionConfig: Record<string, string> = {};
      if (newRule.action_type === 'webhook') actionConfig['url'] = newRule.webhook_url;
      else if (newRule.action_type === 'tag_contact') actionConfig['tag'] = newRule.tag_name;
      else if (newRule.action_type === 'send_sms') actionConfig['message'] = newRule.sms_message;
      else if (newRule.action_type === 'notify_team') actionConfig['email'] = newRule.notify_email;
      else if (newRule.action_type === 'add_to_campaign') actionConfig['campaign_id'] = newRule.campaign_id;

      const res = await fetch(`/api/agents/${agent.id}/automation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRule.name,
          trigger_outcome: newRule.trigger_outcome,
          action_type: newRule.action_type,
          action_config: actionConfig,
        }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      const rule = await res.json() as AutomationRule;
      setAutomationRules(r => [...r, rule]);
      setShowNewRule(false);
      setNewRule({ name: '', trigger_outcome: 'converted', action_type: 'webhook', webhook_url: '', tag_name: '', sms_message: '', notify_email: '', campaign_id: '' });
      toast.success('Automation rule created');
    } catch (e) { toast.error(String(e)); }
    finally { setSavingRule(false); }
  }

  function updateDynVars(entries: { key: string; value: string }[]) {
    setDynVars(entries);
    const record: Record<string, string> = {};
    entries.filter(e => e.key).forEach(e => { record[e.key] = e.value; });
    setForm(f => ({ ...f, dynamic_variables: record }));
  }

  function setField<K extends keyof Agent>(key: K, val: Agent[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      toast.success('Agent saved');
      router.refresh();
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  async function deleteAgent() {
    if (!confirm('Delete this agent? This cannot be undone.')) return;
    setDeleting(true);
    const res = await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Agent deleted'); router.push('/agents'); }
    else { toast.error('Delete failed'); setDeleting(false); }
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="basics">
        <TabsList>
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
          <TabsTrigger value="automation" onClick={loadAutomation}>Automation</TabsTrigger>
          <TabsTrigger value="scorecard"><Star className="h-3.5 w-3.5 mr-1" />Scorecard</TabsTrigger>
        </TabsList>

        <TabsContent value="basics" className="space-y-4 pt-4">
          <Card><CardHeader><CardTitle>Basic Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5"><Label>Name</Label>
                <Input value={form.name ?? ''} onChange={(e) => setField('name', e.target.value)} />
              </div>
              <div className="space-y-1.5"><Label>Voice Engine</Label>
                <Select value={form.voice_engine ?? 'standard'} onValueChange={(v) => setField('voice_engine', v as Agent['voice_engine'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Voice</SelectItem>
                    <SelectItem value="ultra_fast">Ultra-Fast Voice</SelectItem>
                    <SelectItem value="premium">Premium Voice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Status</Label>
                <Select value={form.status ?? 'active'} onValueChange={(v) => setField('status', v as Agent['status'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4 pt-4">
          <Card><CardHeader><CardTitle>Prompt & Behavior</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5"><Label>Objective</Label>
                <Input value={form.objective ?? ''} onChange={(e) => setField('objective', e.target.value)} />
              </div>
              <div className="space-y-1.5"><Label>System Prompt</Label>
                <Textarea rows={8} value={form.system_prompt ?? ''} onChange={(e) => setField('system_prompt', e.target.value)} />
              </div>
              <div className="space-y-1.5"><Label>First Message</Label>
                <Textarea rows={3} value={form.first_message ?? ''} onChange={(e) => setField('first_message', e.target.value)} />
              </div>
              <div className="space-y-1.5"><Label>Voicemail Message</Label>
                <Textarea rows={3} value={form.voicemail_message ?? ''} onChange={(e) => setField('voicemail_message', e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4 pt-4">
          <Card><CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Start Time</Label>
                  <Input type="time" value={form.schedule_start_time ?? '09:00'} onChange={(e) => setField('schedule_start_time', e.target.value)} />
                </div>
                <div className="space-y-1.5"><Label>End Time</Label>
                  <Input type="time" value={form.schedule_end_time ?? '18:00'} onChange={(e) => setField('schedule_end_time', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Max Attempts</Label>
                  <Input type="number" min={1} max={10} value={form.max_attempts ?? 3} onChange={(e) => setField('max_attempts', Number(e.target.value))} />
                </div>
                <div className="space-y-1.5"><Label>Retry (min)</Label>
                  <Input type="number" min={15} value={form.retry_interval_minutes ?? 60} onChange={(e) => setField('retry_interval_minutes', Number(e.target.value))} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4 pt-4">
          <Card><CardHeader><CardTitle>Advanced</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5"><Label>Phone Number</Label>
                <Select value={form.phone_number_id ?? 'none'} onValueChange={(v) => setField('phone_number_id', v === 'none' ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Select phone number" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {phoneNumbers.map((p) => <SelectItem key={p.id} value={p.id}>{p.number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {[
                { key: 'interruption_handling' as const, label: 'Interruption Handling' },
                { key: 'noise_cancellation' as const, label: 'Noise Cancellation' },
                { key: 'post_call_analysis_enabled' as const, label: 'Post-Call Analysis' },
                { key: 'transfer_enabled' as const, label: 'Call Transfer' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <Switch checked={!!form[key]} onCheckedChange={(v) => setField(key, v as Agent[typeof key])} />
                  <Label>{label}</Label>
                </div>
              ))}

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <Label>Dynamic Variables</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateDynVars([...dynVars, { key: '', value: '' }])}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                <p className="text-xs text-[#6b6b6b]">Variables injected into the agent's prompts at call time.</p>
                {dynVars.map((entry, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      placeholder="key"
                      value={entry.key}
                      onChange={(e) => {
                        const next = [...dynVars];
                        next[idx] = { ...next[idx]!, key: e.target.value };
                        updateDynVars(next);
                      }}
                      className="font-mono text-sm"
                    />
                    <Input
                      placeholder="value"
                      value={entry.value}
                      onChange={(e) => {
                        const next = [...dynVars];
                        next[idx] = { ...next[idx]!, value: e.target.value };
                        updateDynVars(next);
                      }}
                      className="font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => updateDynVars(dynVars.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[#6b6b6b]" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Automation Rules</CardTitle>
                <CardDescription className="mt-1">Trigger actions automatically based on call outcomes.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowNewRule(v => !v)}>
                {showNewRule ? <><ChevronUp className="h-4 w-4 mr-1" /> Cancel</> : <><Plus className="h-4 w-4 mr-1" /> New Rule</>}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {showNewRule && (
                <div className="rounded-lg border border-[#e0e0e0] bg-[#f5f5f5] p-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label>Rule Name</Label>
                    <Input
                      placeholder="e.g. Notify on conversion"
                      value={newRule.name}
                      onChange={(e) => setNewRule(r => ({ ...r, name: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Trigger (when)</Label>
                      <Select value={newRule.trigger_outcome} onValueChange={(v) => setNewRule(r => ({ ...r, trigger_outcome: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Action (then)</Label>
                      <Select value={newRule.action_type} onValueChange={(v) => setNewRule(r => ({ ...r, action_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ACTION_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {newRule.action_type === 'webhook' && (
                    <div className="space-y-1.5">
                      <Label>Webhook URL</Label>
                      <Input placeholder="https://your-server.com/webhook" value={newRule.webhook_url} onChange={(e) => setNewRule(r => ({ ...r, webhook_url: e.target.value }))} />
                    </div>
                  )}
                  {newRule.action_type === 'tag_contact' && (
                    <div className="space-y-1.5">
                      <Label>Tag Name</Label>
                      <Input placeholder="e.g. hot-lead" value={newRule.tag_name} onChange={(e) => setNewRule(r => ({ ...r, tag_name: e.target.value }))} />
                    </div>
                  )}
                  {newRule.action_type === 'send_sms' && (
                    <div className="space-y-1.5">
                      <Label>SMS Message</Label>
                      <Textarea rows={2} placeholder="Thanks for your interest! We'll be in touch." value={newRule.sms_message} onChange={(e) => setNewRule(r => ({ ...r, sms_message: e.target.value }))} />
                    </div>
                  )}
                  {newRule.action_type === 'notify_team' && (
                    <div className="space-y-1.5">
                      <Label>Notify Email</Label>
                      <Input type="email" placeholder="team@yourcompany.com" value={newRule.notify_email} onChange={(e) => setNewRule(r => ({ ...r, notify_email: e.target.value }))} />
                    </div>
                  )}
                  {newRule.action_type === 'add_to_campaign' && (
                    <div className="space-y-1.5">
                      <Label>Campaign ID</Label>
                      <Input placeholder="Campaign UUID" value={newRule.campaign_id} onChange={(e) => setNewRule(r => ({ ...r, campaign_id: e.target.value }))} />
                    </div>
                  )}
                  <Button onClick={createRule} disabled={savingRule} size="sm">
                    {savingRule ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Creating…</> : <><Zap className="h-4 w-4 mr-1" /> Create Rule</>}
                  </Button>
                </div>
              )}

              {!automationLoaded && !showNewRule && (
                <p className="text-sm text-[#6b6b6b]">Click the tab to load rules.</p>
              )}

              {automationLoaded && automationRules.length === 0 && !showNewRule && (
                <div className="text-center py-8">
                  <Zap className="h-8 w-8 text-[#e0e0e0] mx-auto mb-2" />
                  <p className="text-sm font-medium text-[#0a0a0a]">No automation rules yet</p>
                  <p className="text-xs text-[#6b6b6b] mt-1">Create a rule to trigger actions when a call ends with a specific outcome.</p>
                </div>
              )}

              {automationRules.map((rule) => (
                <div key={rule.id} className="flex items-center gap-3 rounded-lg border border-[#e0e0e0] p-3">
                  <Switch checked={rule.enabled} onCheckedChange={(v) => toggleRule(rule.id, v)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[#0a0a0a] truncate">{rule.name}</span>
                      <Badge variant="outline" className="text-[10px] border-[#e0e0e0] text-[#6b6b6b] shrink-0">
                        {TRIGGER_LABELS[rule.trigger_outcome] ?? rule.trigger_outcome}
                      </Badge>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${ACTION_COLORS[rule.action_type] ?? 'bg-gray-100 text-gray-700'}`}>
                        {ACTION_LABELS[rule.action_type] ?? rule.action_type}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => deleteRule(rule.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-[#6b6b6b]" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="scorecard" className="pt-4">
          <AgentScorecard agentId={agent.id} />
        </TabsContent>
      </Tabs>

      <div className="flex justify-between pt-2">
        <Button variant="outline" className="text-[#6b6b6b]" onClick={deleteAgent} disabled={deleting}>
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
          Delete Agent
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
