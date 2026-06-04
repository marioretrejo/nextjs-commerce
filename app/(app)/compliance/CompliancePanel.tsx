'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  PhoneOff, Clock, Lock, FileText, Trash2, Plus, Upload,
  CheckCircle2, AlertTriangle, Download, ShieldCheck,
} from 'lucide-react';
import type { DncEntry, ComplianceSettings } from '@/lib/supabase/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { QARulesManager } from './QARulesManager';

const DEFAULT_SETTINGS: Partial<ComplianceSettings> = {
  calling_hours_enabled: false,
  calling_hours_start: '09:00',
  calling_hours_end: '20:00',
  calling_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  call_recording_retention_days: 90,
  transcript_retention_days: 365,
  require_consent: false,
  consent_message: '',
  tcpa_compliance_enabled: false,
  gdpr_compliance_enabled: false,
};

const DAYS = [
  { id: 'mon', label: 'Mon' }, { id: 'tue', label: 'Tue' }, { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' }, { id: 'fri', label: 'Fri' }, { id: 'sat', label: 'Sat' }, { id: 'sun', label: 'Sun' },
];

export function CompliancePanel() {
  const [dncEntries, setDncEntries] = useState<DncEntry[]>([]);
  const [settings, setSettings] = useState<Partial<ComplianceSettings>>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const [newPhone, setNewPhone] = useState('');
  const [newReason, setNewReason] = useState('');
  const [addingPhone, setAddingPhone] = useState(false);
  const [dncSearch, setDncSearch] = useState('');

  const [bulkInput, setBulkInput] = useState('');
  const [bulkImporting, setBulkImporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [dncRes, settingsRes] = await Promise.all([
      fetch('/api/compliance/dnc'),
      fetch('/api/compliance/settings'),
    ]);
    if (dncRes.ok) setDncEntries(await dncRes.json() as DncEntry[]);
    if (settingsRes.ok) {
      const s = await settingsRes.json() as ComplianceSettings | null;
      if (s) setSettings(s);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function addDncEntry() {
    if (!newPhone.trim()) { toast.error('Phone number is required'); return; }
    setAddingPhone(true);
    try {
      const res = await fetch('/api/compliance/dnc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: newPhone.trim(), reason: newReason || undefined }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      const entry = await res.json() as DncEntry;
      setDncEntries(e => [entry, ...e]);
      setNewPhone(''); setNewReason('');
      toast.success('Number added to DNC list');
    } catch (e) { toast.error(String(e)); }
    finally { setAddingPhone(false); }
  }

  async function removeDncEntry(id: string) {
    await fetch(`/api/compliance/dnc?id=${id}`, { method: 'DELETE' });
    setDncEntries(e => e.filter(x => x.id !== id));
    toast.success('Number removed from DNC list');
  }

  async function bulkImport() {
    const phones = bulkInput.split('\n').map(p => p.trim()).filter(Boolean);
    if (!phones.length) { toast.error('No valid phone numbers found'); return; }
    setBulkImporting(true);
    try {
      const res = await fetch('/api/compliance/dnc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      const { inserted } = await res.json() as { inserted: number };
      toast.success(`${inserted} numbers imported`);
      setBulkInput('');
      fetchData();
    } catch (e) { toast.error(String(e)); }
    finally { setBulkImporting(false); }
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/compliance/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      toast.success('Compliance settings saved');
    } catch (e) { toast.error(String(e)); }
    finally { setSavingSettings(false); }
  }

  function toggleDay(day: string) {
    const days = settings.calling_days ?? [];
    setSettings(s => ({
      ...s,
      calling_days: days.includes(day) ? days.filter(d => d !== day) : [...days, day],
    }));
  }

  const filteredDnc = dncEntries.filter(e =>
    dncSearch === '' || e.phone.includes(dncSearch) || (e.reason ?? '').toLowerCase().includes(dncSearch.toLowerCase())
  );

  const checks = [
    { label: 'DNC list configured', pass: dncEntries.length > 0 },
    { label: 'Calling hours restricted', pass: !!settings.calling_hours_enabled },
    { label: 'Call recording retention set', pass: (settings.call_recording_retention_days ?? 0) > 0 },
    { label: 'Consent required', pass: !!settings.require_consent },
    { label: 'TCPA compliance enabled', pass: !!settings.tcpa_compliance_enabled },
    { label: 'GDPR compliance enabled', pass: !!settings.gdpr_compliance_enabled },
  ];
  const score = Math.round((checks.filter(c => c.pass).length / checks.length) * 100);

  if (loading) {
    return <div className="h-64 bg-[#f5f5f5] rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[#111]">Compliance Rules</h3>
          <p className="text-xs text-[#6b6b6b] mt-0.5">DNC lists, calling hours, data policies, and QA scoring rules</p>
        </div>
        <Badge
          className={score >= 80 ? 'bg-green-600 text-white' : score >= 50 ? 'bg-yellow-500 text-white' : 'bg-red-600 text-white'}
        >
          Score {score}%
        </Badge>
      </div>

      <Tabs defaultValue="dnc">
        <TabsList className="h-9">
          <TabsTrigger value="dnc" className="text-xs gap-1.5">
            <PhoneOff className="h-3.5 w-3.5" />DNC List
          </TabsTrigger>
          <TabsTrigger value="hours" className="text-xs gap-1.5">
            <Clock className="h-3.5 w-3.5" />Calling Hours
          </TabsTrigger>
          <TabsTrigger value="privacy" className="text-xs gap-1.5">
            <Lock className="h-3.5 w-3.5" />Data &amp; Privacy
          </TabsTrigger>
          <TabsTrigger value="report" className="text-xs gap-1.5">
            <FileText className="h-3.5 w-3.5" />Report
          </TabsTrigger>
          <TabsTrigger value="qa-rules" className="text-xs gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />QA Rules
          </TabsTrigger>
        </TabsList>

        {/* DNC */}
        <TabsContent value="dnc" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Add Number</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Phone Number</Label>
                  <Input placeholder="+1 (555) 000-0000" value={newPhone} onChange={e => setNewPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDncEntry()} />
                </div>
                <div className="space-y-1.5">
                  <Label>Reason (optional)</Label>
                  <Input placeholder="e.g. Customer request" value={newReason} onChange={e => setNewReason(e.target.value)} />
                </div>
                <Button onClick={addDncEntry} disabled={addingPhone} size="sm" className="w-full gap-1.5">
                  <Plus className="h-3.5 w-3.5" />Add to DNC List
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Bulk Import</CardTitle>
                <CardDescription>One phone number per line</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea placeholder={"+1234567890\n+0987654321"} rows={4} value={bulkInput} onChange={e => setBulkInput(e.target.value)} />
                <Button onClick={bulkImport} disabled={bulkImporting} size="sm" variant="outline" className="w-full gap-1.5">
                  <Upload className="h-3.5 w-3.5" />{bulkImporting ? 'Importing…' : 'Import Numbers'}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-sm">DNC Registry</CardTitle>
                <CardDescription>{dncEntries.length} numbers blocked</CardDescription>
              </div>
              <div className="flex gap-2">
                <Input placeholder="Search…" value={dncSearch} onChange={e => setDncSearch(e.target.value)} className="w-40 h-8 text-xs" />
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                  const csv = 'phone,reason,added_at\n' + dncEntries.map(e => `${e.phone},${e.reason ?? ''},${e.added_at}`).join('\n');
                  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                  const a = document.createElement('a'); a.href = url; a.download = 'dnc-list.csv'; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="h-3.5 w-3.5" />Export
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredDnc.length === 0 ? (
                <div className="py-12 text-center">
                  <PhoneOff className="h-8 w-8 text-[#e0e0e0] mx-auto mb-2" />
                  <p className="text-sm text-[#6b6b6b]">{dncSearch ? 'No matching numbers' : 'No numbers in DNC list yet'}</p>
                </div>
              ) : (
                <div className="divide-y divide-[#f0f0f0]">
                  {filteredDnc.map(entry => (
                    <div key={entry.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium font-mono">{entry.phone}</p>
                        {entry.reason && <p className="text-xs text-[#6b6b6b]">{entry.reason}</p>}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-[#9b9b9b]">{format(new Date(entry.added_at), 'MMM d, yyyy')}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeDncEntry(entry.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-[#9b9b9b]" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calling Hours */}
        <TabsContent value="hours" className="pt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Global Calling Hours</CardTitle>
              <CardDescription>Override all agents with workspace-wide calling restrictions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-3">
                <Switch checked={!!settings.calling_hours_enabled} onCheckedChange={v => setSettings(s => ({ ...s, calling_hours_enabled: v }))} />
                <div>
                  <Label>Enable Global Calling Hours</Label>
                  <p className="text-xs text-[#9b9b9b]">Restricts all outbound calls to the time window below</p>
                </div>
              </div>
              {settings.calling_hours_enabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Start Time</Label>
                      <Input type="time" value={settings.calling_hours_start ?? '09:00'} onChange={e => setSettings(s => ({ ...s, calling_hours_start: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>End Time</Label>
                      <Input type="time" value={settings.calling_hours_end ?? '20:00'} onChange={e => setSettings(s => ({ ...s, calling_hours_end: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Allowed Days</Label>
                    <div className="flex gap-2 flex-wrap">
                      {DAYS.map(d => (
                        <button key={d.id} onClick={() => toggleDay(d.id)}
                          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${(settings.calling_days ?? []).includes(d.id) ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white' : 'border-[#e0e0e0] text-[#0a0a0a] hover:border-[#0a0a0a]'}`}
                        >{d.label}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <Button onClick={saveSettings} disabled={savingSettings} size="sm">
                {savingSettings ? 'Saving…' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data & Privacy */}
        <TabsContent value="privacy" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Data Retention</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Recording Retention (days)</Label>
                  <Input type="number" min={1} max={2555} value={settings.call_recording_retention_days ?? 90} onChange={e => setSettings(s => ({ ...s, call_recording_retention_days: Number(e.target.value) }))} />
                  <p className="text-xs text-[#9b9b9b]">Recordings older than this are auto-deleted</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Transcript Retention (days)</Label>
                  <Input type="number" min={1} max={2555} value={settings.transcript_retention_days ?? 365} onChange={e => setSettings(s => ({ ...s, transcript_retention_days: Number(e.target.value) }))} />
                  <p className="text-xs text-[#9b9b9b]">Transcripts older than this are auto-deleted</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Consent &amp; Frameworks</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-3">
                <Switch checked={!!settings.require_consent} onCheckedChange={v => setSettings(s => ({ ...s, require_consent: v }))} />
                <div>
                  <Label>Require Consent Before Calling</Label>
                  <p className="text-xs text-[#9b9b9b]">Agent verifies consent at the start of each call</p>
                </div>
              </div>
              {settings.require_consent && (
                <div className="space-y-1.5">
                  <Label>Consent Message</Label>
                  <Textarea rows={3} placeholder="This call may be recorded for quality assurance purposes…" value={settings.consent_message ?? ''} onChange={e => setSettings(s => ({ ...s, consent_message: e.target.value }))} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 rounded-lg border border-[#e8e8e8] p-4">
                  <Switch checked={!!settings.tcpa_compliance_enabled} onCheckedChange={v => setSettings(s => ({ ...s, tcpa_compliance_enabled: v }))} />
                  <div>
                    <Label>TCPA Mode</Label>
                    <p className="text-xs text-[#9b9b9b] mt-0.5">US Telephone Consumer Protection Act</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-[#e8e8e8] p-4">
                  <Switch checked={!!settings.gdpr_compliance_enabled} onCheckedChange={v => setSettings(s => ({ ...s, gdpr_compliance_enabled: v }))} />
                  <div>
                    <Label>GDPR Mode</Label>
                    <p className="text-xs text-[#9b9b9b] mt-0.5">EU General Data Protection Regulation</p>
                  </div>
                </div>
              </div>
              <Button onClick={saveSettings} disabled={savingSettings} size="sm">
                {savingSettings ? 'Saving…' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Report */}
        <TabsContent value="report" className="space-y-4 pt-4">
          <div className="grid grid-cols-3 gap-4">
            <Card className={score >= 80 ? 'border-green-200 bg-green-50' : score >= 50 ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'}>
              <CardContent className="pt-6 text-center">
                <p className={`text-4xl font-bold mb-1 ${score >= 80 ? 'text-green-700' : score >= 50 ? 'text-yellow-700' : 'text-red-700'}`}>{score}%</p>
                <p className="text-sm font-medium">Compliance Score</p>
                <p className="text-xs text-[#6b6b6b] mt-1">{score >= 80 ? 'Good standing' : score >= 50 ? 'Needs improvement' : 'Action required'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-4xl font-bold mb-1">{dncEntries.length}</p>
                <p className="text-sm font-medium">DNC Entries</p>
                <p className="text-xs text-[#6b6b6b] mt-1">Numbers blocked</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-4xl font-bold mb-1">{checks.filter(c => c.pass).length}/{checks.length}</p>
                <p className="text-sm font-medium">Checks Passing</p>
                <p className="text-xs text-[#6b6b6b] mt-1">Compliance checklist</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Compliance Checklist</CardTitle></CardHeader>
            <CardContent className="divide-y divide-[#f0f0f0]">
              {checks.map(({ label, pass }) => (
                <div key={label} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {pass ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}
                    <span className="text-sm">{label}</span>
                  </div>
                  <Badge variant={pass ? 'default' : 'secondary'} className={pass ? 'bg-green-100 text-green-700 border-transparent' : ''}>
                    {pass ? 'Pass' : 'Action needed'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* QA Rules */}
        <TabsContent value="qa-rules" className="pt-4">
          <QARulesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
