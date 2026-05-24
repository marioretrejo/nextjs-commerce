'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, Loader2, Play, Volume2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const STEPS = ['Basics', 'Voice', 'Behavior', 'Schedule', 'Advanced', 'Review'];
const DAYS = [
  { id: 'mon', label: 'Mon' }, { id: 'tue', label: 'Tue' }, { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' }, { id: 'fri', label: 'Fri' }, { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' }
];
const LANGUAGES = [
  { value: 'en-US', label: 'English (US)' }, { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Spanish (ES)' }, { value: 'es-MX', label: 'Spanish (MX)' },
  { value: 'pt-BR', label: 'Portuguese (BR)' }, { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' }, { value: 'it-IT', label: 'Italian' },
  { value: 'zh-CN', label: 'Chinese (Mandarin)' }, { value: 'ja-JP', label: 'Japanese' },
  { value: 'ar-SA', label: 'Arabic' }
];
const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Bogota', 'America/Mexico_City', 'America/Buenos_Aires', 'America/Santiago',
  'Europe/London', 'Europe/Madrid', 'Europe/Berlin', 'Europe/Paris',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney'
];

interface Voice { voice_id: string; name: string; preview_url: string; labels: Record<string, string> }

export default function NewAgentPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState('');

  const [form, setForm] = useState({
    name: '',
    language: 'en-US',
    auto_language_detection: false,
    voice_engine: 'retell' as 'retell' | 'elevenlabs' | 'hybrid',
    voice_id: '',
    voice_name: '',
    emotional_speed: 1.0,
    emotional_pitch: 1.0,
    emotional_expressiveness: 0.7,
    objective: '',
    personality: '',
    system_prompt: '',
    first_message: '',
    voicemail_message: '',
    schedule_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    schedule_start_time: '09:00',
    schedule_end_time: '18:00',
    timezone: 'America/New_York',
    max_attempts: 3,
    retry_interval_minutes: 60,
    phone_number_id: '',
    branded_caller_id: '',
    transfer_enabled: false,
    transfer_number: '',
    transfer_type: 'warm' as 'warm' | 'cold',
    transfer_condition: '',
    interruption_handling: true,
    noise_cancellation: true,
    ivr_mode: false,
    dtmf_enabled: false,
    post_call_analysis_enabled: true,
    dynamic_variables: {} as Record<string, string>
  });

  useEffect(() => {
    // Get workspace id
    fetch('/api/agents?workspace_id=_', { method: 'HEAD' });
    // Fetch workspace from localStorage or from API
    async function load() {
      const res = await fetch('/api/agents?workspace_id=check');
      if (res.ok) {
        const data = await res.json() as { workspace_id?: string };
        if (data.workspace_id) setWorkspaceId(data.workspace_id);
      }
      // Fetch voices
      const vRes = await fetch('/api/voices');
      if (vRes.ok) {
        const vData = await vRes.json() as { voices: Voice[] };
        setVoices(vData.voices ?? []);
        if (vData.voices?.[0]) {
          setForm((f) => ({ ...f, voice_id: vData.voices[0]!.voice_id, voice_name: vData.voices[0]!.name }));
        }
      }
    }
    load();
    // Get workspace from session
    fetch('/api/billing/checkout', { method: 'HEAD' }).catch(() => {});
  }, []);

  // Fetch workspace_id from the user's workspaces
  useEffect(() => {
    async function fetchWs() {
      const r = await fetch('/api/admin/workspace-id');
      if (r.ok) {
        const d = await r.json() as { workspace_id: string };
        setWorkspaceId(d.workspace_id ?? '');
      }
    }
    fetchWs();
  }, []);

  function setField<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      schedule_days: f.schedule_days.includes(day)
        ? f.schedule_days.filter((d) => d !== day)
        : [...f.schedule_days, day]
    }));
  }

  async function playPreview(voice: Voice) {
    if (!voice.preview_url) return;
    setPlayingVoice(voice.voice_id);
    const audio = new Audio(voice.preview_url);
    audio.play();
    audio.onended = () => setPlayingVoice(null);
  }

  async function handleSave() {
    if (!form.name) { toast.error('Agent name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, workspace_id: workspaceId })
      });
      if (!res.ok) {
        const e = await res.json() as { error: string };
        throw new Error(e.error);
      }
      const agent = await res.json() as { id: string };
      toast.success('Agent created!');
      router.push(`/agents/${agent.id}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  const tokenCount = Math.ceil(form.system_prompt.length / 4);

  return (
    <div className="p-6 mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Agent</h1>
        <p className="text-sm text-[#6b6b6b]">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-[#0a0a0a]' : 'bg-[#e0e0e0]'}`}
          />
        ))}
      </div>

      {/* Step 1: Basics */}
      {step === 0 && (
        <Card>
          <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Agent Name *</Label>
              <Input placeholder="e.g. Sales SDR, Appointment Setter" value={form.name} onChange={(e) => setField('name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Select value={form.language} onValueChange={(v) => setField('language', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.auto_language_detection} onCheckedChange={(v) => setField('auto_language_detection', v)} />
              <div>
                <Label>Auto Language Detection</Label>
                <p className="text-xs text-[#6b6b6b]">Detect and match the caller's language automatically</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Voice */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Voice Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Voice Engine</Label>
              <div className="grid grid-cols-3 gap-3">
                {(['retell', 'elevenlabs', 'hybrid'] as const).map((e) => (
                  <button
                    key={e}
                    onClick={() => setField('voice_engine', e)}
                    className={`rounded-md border p-3 text-sm font-medium capitalize transition-colors ${form.voice_engine === e ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white' : 'border-[#e0e0e0] hover:border-[#0a0a0a]'}`}
                  >
                    {e === 'elevenlabs' ? 'ElevenLabs' : e.charAt(0).toUpperCase() + e.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Voice</Label>
              <div className="max-h-64 overflow-y-auto rounded-md border border-[#e0e0e0]">
                {voices.length === 0 ? (
                  <div className="p-4 text-center text-sm text-[#6b6b6b]">Loading voices…</div>
                ) : voices.map((v) => (
                  <div
                    key={v.voice_id}
                    onClick={() => setForm((f) => ({ ...f, voice_id: v.voice_id, voice_name: v.name }))}
                    className={`flex items-center justify-between p-3 cursor-pointer border-b border-[#e0e0e0] last:border-b-0 transition-colors ${form.voice_id === v.voice_id ? 'bg-[#0a0a0a] text-white' : 'hover:bg-[#f5f5f5]'}`}
                  >
                    <div>
                      <p className="text-sm font-medium">{v.name}</p>
                      <p className={`text-xs ${form.voice_id === v.voice_id ? 'text-[#aaa]' : 'text-[#6b6b6b]'}`}>
                        {v.labels?.['gender'] ?? ''} {v.labels?.['accent'] ? `· ${v.labels['accent']}` : ''}
                      </p>
                    </div>
                    {v.preview_url && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); playPreview(v); }}
                        className="p-1.5 rounded-md hover:bg-white/20"
                      >
                        {playingVoice === v.voice_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Label>Emotional Controls</Label>
              {[
                { key: 'emotional_speed' as const, label: 'Speed', min: 0.5, max: 2.0, step: 0.1 },
                { key: 'emotional_pitch' as const, label: 'Pitch', min: 0.5, max: 2.0, step: 0.1 },
                { key: 'emotional_expressiveness' as const, label: 'Expressiveness', min: 0, max: 1, step: 0.05 }
              ].map(({ key, label, min, max, step: s }) => (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="text-[#6b6b6b]">{form[key].toFixed(2)}</span>
                  </div>
                  <Slider
                    min={min} max={max} step={s}
                    value={[form[key]]}
                    onValueChange={([v]) => setField(key, v ?? form[key])}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Behavior */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Behavior & Prompt</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Objective</Label>
              <Input placeholder="e.g. Schedule a product demo with qualified leads" value={form.objective} onChange={(e) => setField('objective', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Personality</Label>
              <Input placeholder="e.g. Professional, empathetic, confident, concise" value={form.personality} onChange={(e) => setField('personality', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label>System Prompt</Label>
                <span className="text-xs text-[#6b6b6b]">~{tokenCount} tokens</span>
              </div>
              <Textarea
                rows={8}
                placeholder="You are a friendly sales representative for Acme Inc. Your goal is to..."
                value={form.system_prompt}
                onChange={(e) => setField('system_prompt', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>First Message</Label>
              <Textarea rows={3} placeholder="Hello! I'm calling from Acme Inc. Is this a good time to talk?" value={form.first_message} onChange={(e) => setField('first_message', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Voicemail Message</Label>
              <Textarea rows={3} placeholder="Hi, I'm calling from Acme Inc. Please call us back at..." value={form.voicemail_message} onChange={(e) => setField('voicemail_message', e.target.value)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Schedule */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Call Schedule</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Active Days</Label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => toggleDay(d.id)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${form.schedule_days.includes(d.id) ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white' : 'border-[#e0e0e0] hover:border-[#0a0a0a]'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" value={form.schedule_start_time} onChange={(e) => setField('schedule_start_time', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input type="time" value={form.schedule_end_time} onChange={(e) => setField('schedule_end_time', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select value={form.timezone} onValueChange={(v) => setField('timezone', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Max Attempts</Label>
                <Input type="number" min={1} max={10} value={form.max_attempts} onChange={(e) => setField('max_attempts', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Retry Interval (min)</Label>
                <Input type="number" min={15} value={form.retry_interval_minutes} onChange={(e) => setField('retry_interval_minutes', Number(e.target.value))} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Advanced */}
      {step === 4 && (
        <Card>
          <CardHeader><CardTitle>Advanced Settings</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Branded Caller ID</Label>
              <Input placeholder="Acme Inc." value={form.branded_caller_id} onChange={(e) => setField('branded_caller_id', e.target.value)} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch checked={form.transfer_enabled} onCheckedChange={(v) => setField('transfer_enabled', v)} />
                <Label>Enable Call Transfer</Label>
              </div>
              {form.transfer_enabled && (
                <div className="ml-8 space-y-3 border-l-2 border-[#e0e0e0] pl-4">
                  <div className="space-y-1.5">
                    <Label>Transfer Number</Label>
                    <Input placeholder="+1234567890" value={form.transfer_number} onChange={(e) => setField('transfer_number', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Transfer Type</Label>
                    <Select value={form.transfer_type} onValueChange={(v) => setField('transfer_type', v as 'warm' | 'cold')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warm">Warm (announce before transfer)</SelectItem>
                        <SelectItem value="cold">Cold (blind transfer)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Transfer Condition</Label>
                    <Input placeholder="e.g. When prospect asks to speak to a human" value={form.transfer_condition} onChange={(e) => setField('transfer_condition', e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {[
                { key: 'interruption_handling' as const, label: 'Interruption Handling', desc: 'Allow caller to interrupt the agent' },
                { key: 'noise_cancellation' as const, label: 'Noise Cancellation', desc: 'Filter background noise from calls' },
                { key: 'ivr_mode' as const, label: 'IVR Mode', desc: 'Navigate phone trees automatically' },
                { key: 'dtmf_enabled' as const, label: 'DTMF (Keypad)', desc: 'Send touch-tone keypad inputs' },
                { key: 'post_call_analysis_enabled' as const, label: 'Post-Call Analysis', desc: 'Auto-generate summary and extracted data' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-start gap-3">
                  <Switch className="mt-0.5" checked={form[key]} onCheckedChange={(v) => setField(key, v)} />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-[#6b6b6b]">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Review */}
      {step === 5 && (
        <Card>
          <CardHeader><CardTitle>Review & Create</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-[#e0e0e0] divide-y divide-[#e0e0e0]">
              {[
                { label: 'Name', value: form.name },
                { label: 'Language', value: LANGUAGES.find((l) => l.value === form.language)?.label ?? form.language },
                { label: 'Voice Engine', value: form.voice_engine },
                { label: 'Voice', value: form.voice_name || form.voice_id },
                { label: 'Objective', value: form.objective || '—' },
                { label: 'Schedule', value: `${form.schedule_days.join(', ')} · ${form.schedule_start_time}–${form.schedule_end_time}` },
                { label: 'Max Attempts', value: String(form.max_attempts) },
                { label: 'Transfer', value: form.transfer_enabled ? `${form.transfer_type} → ${form.transfer_number}` : 'Disabled' },
                { label: 'Post-Call Analysis', value: form.post_call_analysis_enabled ? 'Enabled' : 'Disabled' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
                  <span className="text-[#6b6b6b]">{label}</span>
                  <span className="font-medium max-w-[60%] text-right truncate">{value}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#6b6b6b]">
              The agent will be synced to {form.voice_engine === 'retell' || form.voice_engine === 'hybrid' ? 'Retell AI' : 'ElevenLabs'} immediately.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="secondary" onClick={() => step > 0 ? setStep(step - 1) : router.push('/agents')} disabled={saving}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={step === 0 && !form.name}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : 'Create Agent'}
          </Button>
        )}
      </div>
    </div>
  );
}
