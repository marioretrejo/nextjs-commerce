'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Upload, X, BookmarkPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const STEPS = ['Campaign Info', 'Upload Contacts', 'A/B Test', 'Schedule', 'Review'];

interface Agent { id: string; name: string }
interface Contact { name?: string; phone: string; email?: string; [key: string]: string | undefined }

export default function NewCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('template_id');
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [fromTemplate, setFromTemplate] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    agent_id: '',
    max_concurrency: 5,
    retry_enabled: true,
    retry_interval_hours: 24,
    respect_schedule: true,
    timezone: 'America/New_York',
    start_at: '',
    end_at: '',
    ab_enabled: false,
    ab_agent_id: '',
    ab_split_ratio: 50,
  });

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      const wsRes = await fetch('/api/admin/workspace-id');
      const wsData = await wsRes.json() as { workspace_id: string };
      setWorkspaceId(wsData.workspace_id ?? '');

      const agRes = await fetch(`/api/agents?workspace_id=${wsData.workspace_id}`);
      const agData = await agRes.json() as Agent[];
      setAgents(agData ?? []);
      if (agData?.[0]) setForm((f) => ({ ...f, agent_id: agData[0]!.id }));

      if (templateId) {
        const tplRes = await fetch(`/api/campaign-templates?id=${templateId}`);
        if (tplRes.ok) {
          const tpl = await tplRes.json() as { name?: string; description?: string; agent_id?: string; config?: { max_concurrency?: number } };
          setFromTemplate(tpl.name ?? null);
          setForm((f) => ({
            ...f,
            name: tpl.name ? `${tpl.name} (copy)` : f.name,
            description: tpl.description ?? f.description,
            agent_id: tpl.agent_id ?? f.agent_id,
            max_concurrency: tpl.config?.max_concurrency ?? f.max_concurrency,
          }));
        }
      }
    }
    load();
  }, [templateId]);

  async function handleCSV(file: File) {
    const Papa = (await import('papaparse')).default;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        setCsvHeaders(results.meta.fields ?? []);
        const parsed: Contact[] = results.data.map((row) => ({
          name: row['name'] ?? row['Name'] ?? row['nombre'] ?? '',
          phone: row['phone'] ?? row['Phone'] ?? row['telefono'] ?? row['tel'] ?? '',
          email: row['email'] ?? row['Email'] ?? ''
        })).filter((c) => c.phone);
        setContacts(parsed);
        toast.success(`${parsed.length} contacts loaded`);
      }
    });
  }

  async function handleSave() {
    if (!form.name) { toast.error('Campaign name required'); return; }
    if (contacts.length === 0) { toast.error('Upload at least one contact'); return; }
    setSaving(true);

    try {
      // Create campaign
      const payload = {
        ...form,
        workspace_id: workspaceId,
        ab_agent_id: form.ab_enabled && form.ab_agent_id ? form.ab_agent_id : null,
      };
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      const campaign = await res.json() as { id: string };

      // Upload contacts in batches
      const BATCH = 100;
      for (let i = 0; i < contacts.length; i += BATCH) {
        const batch = contacts.slice(i, i + BATCH).map((c) => ({
          campaign_id: campaign.id,
          name: c.name ?? null,
          phone: c.phone,
          email: c.email ?? null,
          variables: c,
          status: 'pending'
        }));
        await fetch('/api/campaigns/' + campaign.id + '/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: batch })
        });
      }

      toast.success('Campaign created!');
      router.push(`/campaigns/${campaign.id}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Campaign</h1>
          <p className="text-sm text-[#6b6b6b]">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
        </div>
      </div>

      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-[#0a0a0a]' : 'bg-[#e0e0e0]'}`} />
        ))}
      </div>

      {fromTemplate && (
        <div className="flex items-center gap-2 rounded-md border border-[#e0e0e0] bg-[#f5f5f5] px-4 py-2.5 text-sm text-[#6b6b6b]">
          <BookmarkPlus className="w-4 h-4 shrink-0" />
          Started from template: <span className="font-medium text-[#0a0a0a]">{fromTemplate}</span>
        </div>
      )}

      {step === 0 && (
        <Card>
          <CardHeader><CardTitle>Campaign Info</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Campaign Name *</Label>
              <Input placeholder="Q2 Outreach, Product Demo Invites…" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea placeholder="What is this campaign about?" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Agent *</Label>
              <Select value={form.agent_id} onValueChange={(v) => setForm((f) => ({ ...f, agent_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select an agent" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Max Concurrent Calls</Label>
                <Input type="number" min={1} max={50} value={form.max_concurrency} onChange={(e) => setForm((f) => ({ ...f, max_concurrency: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Retry Interval (hours)</Label>
                <Input type="number" min={1} value={form.retry_interval_hours} onChange={(e) => setForm((f) => ({ ...f, retry_interval_hours: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.retry_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, retry_enabled: v }))} />
              <Label>Enable Auto-Retry</Label>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Upload Contacts</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[#6b6b6b]">Upload a CSV with columns: <code className="bg-[#f5f5f5] px-1 rounded text-xs">name, phone, email</code>. Additional columns become dynamic variables.</p>
            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#e0e0e0] py-12 cursor-pointer hover:border-[#0a0a0a] transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCSV(f); }}
            >
              <Upload className="h-8 w-8 text-[#6b6b6b] mb-3" />
              <p className="text-sm font-medium">Click or drag CSV file here</p>
              <p className="text-xs text-[#6b6b6b]">Max 10,000 contacts</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSV(f); }} />
            </div>

            {contacts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{contacts.length} contacts loaded</p>
                  <Button variant="ghost" size="sm" onClick={() => setContacts([])}><X className="h-4 w-4" /></Button>
                </div>
                <div className="overflow-hidden rounded-md border border-[#e0e0e0]">
                  <table className="w-full text-xs">
                    <thead className="bg-[#f5f5f5]">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Name</th>
                        <th className="px-3 py-2 text-left font-medium">Phone</th>
                        <th className="px-3 py-2 text-left font-medium">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.slice(0, 5).map((c, i) => (
                        <tr key={i} className="border-t border-[#e0e0e0]">
                          <td className="px-3 py-2">{c.name ?? '—'}</td>
                          <td className="px-3 py-2">{c.phone}</td>
                          <td className="px-3 py-2">{c.email ?? '—'}</td>
                        </tr>
                      ))}
                      {contacts.length > 5 && (
                        <tr className="border-t border-[#e0e0e0]">
                          <td colSpan={3} className="px-3 py-2 text-center text-[#6b6b6b]">+{contacts.length - 5} more contacts</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>A/B Test (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3">
              <Switch checked={form.ab_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, ab_enabled: v }))} />
              <div>
                <Label>Enable A/B Test</Label>
                <p className="text-xs text-[#6b6b6b]">Split contacts between two agents to compare performance</p>
              </div>
            </div>

            {form.ab_enabled && (
              <>
                <div className="space-y-1.5">
                  <Label>Agent B</Label>
                  <Select value={form.ab_agent_id} onValueChange={(v) => setForm((f) => ({ ...f, ab_agent_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select Agent B" /></SelectTrigger>
                    <SelectContent>
                      {agents.filter((a) => a.id !== form.agent_id).map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-[#6b6b6b]">Agent A is already selected in step 1.</p>
                </div>

                <div className="space-y-2">
                  <Label>Split Ratio — Agent A: {form.ab_split_ratio}% / Agent B: {100 - form.ab_split_ratio}%</Label>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    step={10}
                    value={form.ab_split_ratio}
                    onChange={(e) => setForm((f) => ({ ...f, ab_split_ratio: Number(e.target.value) }))}
                    className="w-full accent-[#0a0a0a]"
                  />
                  <div className="flex justify-between text-xs text-[#6b6b6b]">
                    <span>Agent A: {agents.find((a) => a.id === form.agent_id)?.name ?? '—'}</span>
                    <span>Agent B: {agents.find((a) => a.id === form.ab_agent_id)?.name ?? '—'}</span>
                  </div>
                </div>
              </>
            )}

            {!form.ab_enabled && (
              <div className="rounded-lg bg-[#f5f5f5] p-4 text-sm text-[#6b6b6b]">
                Skip this step to run the campaign with a single agent. Enable A/B testing to compare two agents head-to-head.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Date/Time</Label>
                <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date/Time</Label>
                <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select value={form.timezone} onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['America/New_York','America/Chicago','America/Los_Angeles','America/Bogota','Europe/London','Europe/Madrid'].map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.respect_schedule} onCheckedChange={(v) => setForm((f) => ({ ...f, respect_schedule: v }))} />
              <div>
                <Label>Respect Agent Schedule</Label>
                <p className="text-xs text-[#6b6b6b]">Only call during the agent's configured hours</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader><CardTitle>Review & Launch</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-[#e0e0e0] divide-y divide-[#e0e0e0]">
              {[
                { label: 'Campaign Name', value: form.name },
                { label: 'Agent A', value: agents.find((a) => a.id === form.agent_id)?.name ?? '—' },
                ...(form.ab_enabled ? [
                  { label: 'Agent B', value: agents.find((a) => a.id === form.ab_agent_id)?.name ?? '—' },
                  { label: 'A/B Split', value: `${form.ab_split_ratio}% / ${100 - form.ab_split_ratio}%` },
                ] : []),
                { label: 'Contacts', value: `${contacts.length} contacts` },
                { label: 'Concurrency', value: `${form.max_concurrency} simultaneous calls` },
                { label: 'Retry', value: form.retry_enabled ? `Yes, every ${form.retry_interval_hours}h` : 'No' },
                { label: 'Timezone', value: form.timezone },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
                  <span className="text-[#6b6b6b]">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#6b6b6b]">The campaign will be saved as draft. Launch it from the campaign detail page when ready.</p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="secondary" onClick={() => step > 0 ? setStep(step - 1) : router.push('/campaigns')} disabled={saving}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={
              (step === 0 && !form.name) ||
              (step === 1 && contacts.length === 0) ||
              (step === 2 && form.ab_enabled && !form.ab_agent_id)
            }
          >
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Create Campaign'}
          </Button>
        )}
      </div>
    </div>
  );
}
