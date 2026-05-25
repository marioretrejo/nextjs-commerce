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
  Shield, PhoneOff, Clock, Lock, FileText, Trash2, Plus, Upload,
  CheckCircle2, AlertTriangle, Download
} from 'lucide-react';
import type { DncEntry, ComplianceSettings } from '@/lib/supabase/types';
import { toast } from 'sonner';
import { format } from 'date-fns';

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

export default function CompliancePage() {
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
      setNewPhone('');
      setNewReason('');
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
    if (phones.length === 0) { toast.error('No valid phone numbers found'); return; }
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

  // Compliance score
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
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-[#f5f5f5] rounded animate-pulse mb-6" />
        <div className="h-64 bg-[#f5f5f5] rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f5f5]">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compliance Center</h1>
          <p className="text-sm text-[#6b6b6b]">Manage DNC lists, calling hours, data policies, and compliance status</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-[#6b6b6b]">Compliance Score</span>
          <Badge
            className={score >= 80 ? 'bg-green-600 text-white' : score >= 50 ? 'bg-yellow-500 text-white' : 'bg-red-600 text-white'}
          >
            {score}%
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="dnc">
        <TabsList>
          <TabsTrigger value="dnc"><PhoneOff className="h-3.5 w-3.5 mr-1.5" />DNC List</TabsTrigger>
          <TabsTrigger value="hours"><Clock className="h-3.5 w-3.5 mr-1.5" />Calling Hours</TabsTrigger>
          <TabsTrigger value="privacy"><Lock className="h-3.5 w-3.5 mr-1.5" />Data & Privacy</TabsTrigger>
          <TabsTrigger value="report"><FileText className="h-3.5 w-3.5 mr-1.5" />Compliance Report</TabsTrigger>
        </TabsList>

        {/* DNC List Tab */}
        <TabsContent value="dnc" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Add Number</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Phone Number</Label>
                  <Input
                    placeholder="+1 (555) 000-0000"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addDncEntry()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Reason (optional)</Label>
                  <Input
                    placeholder="e.g. Customer request, Legal opt-out"
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                  />
                </div>
                <Button onClick={addDncEntry} disabled={addingPhone} size="sm" className="w-full">
                  <Plus className="h-4 w-4 mr-1" /> Add to DNC List
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Bulk Import</CardTitle><CardDescription>One phone number per line</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder={"+1234567890\n+0987654321\n+1122334455"}
                  rows={4}
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                />
                <Button onClick={bulkImport} disabled={bulkImporting} size="sm" variant="outline" className="w-full">
                  <Upload className="h-4 w-4 mr-1" /> {bulkImporting ? 'Importing…' : 'Import Numbers'}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>DNC Registry</CardTitle>
                <CardDescription>{dncEntries.length} numbers blocked</CardDescription>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Search…"
                  value={dncSearch}
                  onChange={(e) => setDncSearch(e.target.value)}
                  className="w-48 h-8 text-sm"
                />
                <Button variant="outline" size="sm" onClick={() => {
                  const csv = 'phone,reason,added_at\n' + dncEntries.map(e => `${e.phone},${e.reason ?? ''},${e.added_at}`).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'dnc-list.csv'; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Export
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
                <div className="divide-y divide-[#e0e0e0]">
                  {filteredDnc.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <p className="text-sm font-medium font-mono">{entry.phone}</p>
                        {entry.reason && <p className="text-xs text-[#6b6b6b]">{entry.reason}</p>}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-[#6b6b6b]">{format(new Date(entry.added_at), 'MMM d, yyyy')}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeDncEntry(entry.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-[#6b6b6b]" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calling Hours Tab */}
        <TabsContent value="hours" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle>Global Calling Hours</CardTitle><CardDescription>Override all agents with workspace-wide calling restrictions</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-3">
                <Switch
                  checked={!!settings.calling_hours_enabled}
                  onCheckedChange={(v) => setSettings(s => ({ ...s, calling_hours_enabled: v }))}
                />
                <div>
                  <Label>Enable Global Calling Hours</Label>
                  <p className="text-xs text-[#6b6b6b]">Restricts all outbound calls to the time window below</p>
                </div>
              </div>

              {settings.calling_hours_enabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={settings.calling_hours_start ?? '09:00'}
                        onChange={(e) => setSettings(s => ({ ...s, calling_hours_start: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={settings.calling_hours_end ?? '20:00'}
                        onChange={(e) => setSettings(s => ({ ...s, calling_hours_end: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Allowed Days</Label>
                    <div className="flex gap-2">
                      {DAYS.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => toggleDay(d.id)}
                          className={[
                            'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                            (settings.calling_days ?? []).includes(d.id)
                              ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                              : 'border-[#e0e0e0] text-[#0a0a0a] hover:border-[#0a0a0a]',
                          ].join(' ')}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Button onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? 'Saving…' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data & Privacy Tab */}
        <TabsContent value="privacy" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle>Data Retention</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Call Recording Retention (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={2555}
                    value={settings.call_recording_retention_days ?? 90}
                    onChange={(e) => setSettings(s => ({ ...s, call_recording_retention_days: Number(e.target.value) }))}
                  />
                  <p className="text-xs text-[#6b6b6b]">Recordings older than this will be automatically deleted</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Transcript Retention (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={2555}
                    value={settings.transcript_retention_days ?? 365}
                    onChange={(e) => setSettings(s => ({ ...s, transcript_retention_days: Number(e.target.value) }))}
                  />
                  <p className="text-xs text-[#6b6b6b]">Transcripts older than this will be automatically deleted</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Consent & Compliance Frameworks</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-3">
                <Switch
                  checked={!!settings.require_consent}
                  onCheckedChange={(v) => setSettings(s => ({ ...s, require_consent: v }))}
                />
                <div>
                  <Label>Require Consent Before Calling</Label>
                  <p className="text-xs text-[#6b6b6b]">Agent will verify consent at the start of each call</p>
                </div>
              </div>

              {settings.require_consent && (
                <div className="space-y-1.5">
                  <Label>Consent Message</Label>
                  <Textarea
                    rows={3}
                    placeholder="This call may be recorded for quality assurance purposes. By continuing, you consent to..."
                    value={settings.consent_message ?? ''}
                    onChange={(e) => setSettings(s => ({ ...s, consent_message: e.target.value }))}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 rounded-lg border border-[#e0e0e0] p-4">
                  <Switch
                    checked={!!settings.tcpa_compliance_enabled}
                    onCheckedChange={(v) => setSettings(s => ({ ...s, tcpa_compliance_enabled: v }))}
                  />
                  <div>
                    <Label>TCPA Mode</Label>
                    <p className="text-xs text-[#6b6b6b] mt-0.5">US Telephone Consumer Protection Act</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-[#e0e0e0] p-4">
                  <Switch
                    checked={!!settings.gdpr_compliance_enabled}
                    onCheckedChange={(v) => setSettings(s => ({ ...s, gdpr_compliance_enabled: v }))}
                  />
                  <div>
                    <Label>GDPR Mode</Label>
                    <p className="text-xs text-[#6b6b6b] mt-0.5">EU General Data Protection Regulation</p>
                  </div>
                </div>
              </div>

              <Button onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? 'Saving…' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Report Tab */}
        <TabsContent value="report" className="space-y-4 pt-4">
          <div className="grid grid-cols-3 gap-4">
            <Card className={score >= 80 ? 'border-green-200 bg-green-50' : score >= 50 ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'}>
              <CardContent className="pt-6 text-center">
                <p className={`text-4xl font-bold mb-1 ${score >= 80 ? 'text-green-700' : score >= 50 ? 'text-yellow-700' : 'text-red-700'}`}>{score}%</p>
                <p className="text-sm font-medium text-[#0a0a0a]">Compliance Score</p>
                <p className="text-xs text-[#6b6b6b] mt-1">
                  {score >= 80 ? 'Good standing' : score >= 50 ? 'Needs improvement' : 'Action required'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-4xl font-bold text-[#0a0a0a] mb-1">{dncEntries.length}</p>
                <p className="text-sm font-medium text-[#0a0a0a]">DNC Entries</p>
                <p className="text-xs text-[#6b6b6b] mt-1">Numbers blocked from calling</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-4xl font-bold text-[#0a0a0a] mb-1">{checks.filter(c => c.pass).length}/{checks.length}</p>
                <p className="text-sm font-medium text-[#0a0a0a]">Checks Passing</p>
                <p className="text-xs text-[#6b6b6b] mt-1">Compliance checklist</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Compliance Checklist</CardTitle></CardHeader>
            <CardContent className="divide-y divide-[#e0e0e0]">
              {checks.map(({ label, pass }) => (
                <div key={label} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {pass ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
                    )}
                    <span className="text-sm text-[#0a0a0a]">{label}</span>
                  </div>
                  <Badge variant={pass ? 'default' : 'secondary'} className={pass ? 'bg-green-100 text-green-700 border-transparent' : ''}>
                    {pass ? 'Pass' : 'Action needed'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
