'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { Agent } from '@/lib/supabase/types';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

interface PhoneNumber { id: string; number: string; status: string }

export function AgentEditForm({ agent, phoneNumbers }: { agent: Agent; phoneNumbers: PhoneNumber[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<Partial<Agent>>(agent);

  const [dynVars, setDynVars] = useState<{ key: string; value: string }[]>(
    Object.entries(agent.dynamic_variables ?? {}).map(([key, value]) => ({ key, value }))
  );

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
        </TabsList>

        <TabsContent value="basics" className="space-y-4 pt-4">
          <Card><CardHeader><CardTitle>Basic Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5"><Label>Name</Label>
                <Input value={form.name ?? ''} onChange={(e) => setField('name', e.target.value)} />
              </div>
              <div className="space-y-1.5"><Label>Voice Engine</Label>
                <Select value={form.voice_engine ?? 'retell'} onValueChange={(v) => setField('voice_engine', v as Agent['voice_engine'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retell">Retell AI</SelectItem>
                    <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
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
                <Select value={form.phone_number_id ?? ''} onValueChange={(v) => setField('phone_number_id', v || null)}>
                  <SelectTrigger><SelectValue placeholder="Select phone number" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
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
