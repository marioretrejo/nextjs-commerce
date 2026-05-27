'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldTooltip } from '@/components/ui/field-tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronLeft, ChevronRight, Loader2, Play, Plus, Trash2,
  Zap, GitBranch, ArrowLeft, Layers, Search, X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type Screen = 'templates' | 'mode' | 'simple' | 'workflow';

// ─── AGENT TEMPLATES ─────────────────────────────────────────────────────────
interface AgentTemplate {
  id: string;
  name: string;
  language: string;
  languageLabel: string;
  objective: string;
  personality: string;
  first_message: string;
  system_prompt: string;
  voicemail_message: string;
  category: string;
  tags: string[];
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'ventas-latam',
    name: 'Ventas Outbound LATAM',
    language: 'es-MX',
    languageLabel: 'Español',
    objective: 'sales',
    personality: 'Persuasivo, amigable y profesional',
    first_message: 'Hola [nombre], le llamo de [empresa]. ¿Tiene un momento?',
    system_prompt: `Eres un representante de ventas de [empresa]. Tu objetivo es presentar [producto] y agendar una demostración.
Reglas:
- Habla en español formal pero cercano
- Si el prospecto está interesado, agenda una cita
- Si no está interesado, agradece su tiempo cortésmente
- Nunca seas insistente después de una negativa clara`,
    voicemail_message: 'Hola [nombre], le llamo de [empresa]. Por favor devuelva mi llamada. Gracias.',
    category: 'Sales',
    tags: ['LATAM', 'Sales', 'Español'],
  },
  {
    id: 'reactivacion-leads',
    name: 'Reactivación de Leads',
    language: 'es-MX',
    languageLabel: 'Español',
    objective: 'Reactivar leads que mostraron interés anteriormente',
    personality: 'Empático, recordatorio suave, sin presión',
    first_message: 'Hola [nombre], hace un tiempo mostró interés en [producto]. ¿Sigue siendo algo que le interesa?',
    system_prompt: `Eres un agente de reactivación de [empresa]. Tu misión es reconectar con leads que no avanzaron.
- Menciona el interés previo sin presionar
- Ofrece nueva información o una oferta especial
- Si declina, elimina de la lista amablemente`,
    voicemail_message: 'Hola [nombre], le llamamos de [empresa] para retomar su consulta. Llámenos cuando pueda.',
    category: 'Reactivation',
    tags: ['Reactivation', 'Español'],
  },
  {
    id: 'soporte-cliente',
    name: 'Soporte al Cliente',
    language: 'es-MX',
    languageLabel: 'Español',
    objective: 'Resolver dudas y problemas de clientes',
    personality: 'Empático, paciente y solucionador',
    first_message: 'Hola, soy [nombre_agente] de soporte. ¿En qué le puedo ayudar hoy?',
    system_prompt: `Eres un agente de soporte al cliente de [empresa].
- Escucha activamente el problema
- Ofrece soluciones concretas
- Si no puedes resolver el problema, escala al equipo humano
- Siempre confirma si el cliente quedó satisfecho`,
    voicemail_message: 'Hola, le llama soporte de [empresa]. Llamaremos de nuevo pronto.',
    category: 'Support',
    tags: ['Support', 'Español'],
  },
  {
    id: 'agendamiento-citas',
    name: 'Agendamiento de Citas',
    language: 'es-MX',
    languageLabel: 'Español',
    objective: 'Agendar citas o reuniones con prospectos',
    personality: 'Organizado, amable y eficiente',
    first_message: 'Hola [nombre], llamo para coordinar una cita con usted. ¿Tiene disponibilidad esta semana?',
    system_prompt: `Eres un agente de agendamiento de [empresa].
- Ofrece 2-3 opciones de horarios
- Confirma la cita con todos los detalles
- Envía recordatorio de los datos necesarios
- Si no hay disponibilidad, busca la próxima semana`,
    voicemail_message: 'Hola [nombre], llamamos para coordinar su cita. Por favor devuelva la llamada.',
    category: 'Scheduling',
    tags: ['Scheduling', 'Español'],
  },
  {
    id: 'cobranza-amigable',
    name: 'Cobranza Amigable',
    language: 'es-MX',
    languageLabel: 'Español',
    objective: 'Gestionar cobros pendientes de forma empática',
    personality: 'Empático, firme pero comprensivo',
    first_message: 'Buenos días [nombre], le llamo de [empresa] respecto a su cuenta. ¿Tiene un momento?',
    system_prompt: `Eres un agente de cobranza de [empresa].
- Informa sobre el saldo pendiente con respeto
- Ofrece opciones de pago flexibles
- Escucha las razones del retraso sin juzgar
- Si promete pago, confirma fecha exacta`,
    voicemail_message: 'Buenos días [nombre], le llamamos de [empresa] respecto a un asunto de su cuenta.',
    category: 'Collections',
    tags: ['Collections', 'Español'],
  },
  {
    id: 'cold-calling-b2b',
    name: 'Cold Calling B2B',
    language: 'en-US',
    languageLabel: 'English',
    objective: 'sales',
    personality: 'Formal, direct, and confident',
    first_message: 'Hi [name], I\'m calling from [company] regarding [product]. Do you have a moment?',
    system_prompt: `You are a B2B sales representative for [company].
- Lead with value, not features
- Ask qualifying questions early
- Handle objections professionally
- Goal: book a 15-minute discovery call`,
    voicemail_message: 'Hi [name], this is [agent_name] from [company]. I\'d love to connect about [product]. Please call me back.',
    category: 'Sales',
    tags: ['B2B', 'Sales', 'English'],
  },
  {
    id: 'real-estate-qualifier',
    name: 'Real Estate Lead Qualifier',
    language: 'en-US',
    languageLabel: 'English',
    objective: 'Qualify real estate leads and book showings',
    personality: 'Friendly, knowledgeable, trustworthy',
    first_message: 'Hi [name], I saw you were interested in properties in [area]. Are you still looking?',
    system_prompt: `You are a real estate lead qualifier for [agency].
- Qualify: budget, timeline, preferred area, property type
- If qualified, book a showing or agent call
- Be enthusiastic about available properties`,
    voicemail_message: 'Hi [name], this is [agent_name] from [agency]. I\'d love to help you find your perfect home.',
    category: 'Real Estate',
    tags: ['Real Estate', 'English'],
  },
  {
    id: 'healthcare-appointment',
    name: 'Healthcare Appointment Reminder',
    language: 'en-US',
    languageLabel: 'English',
    objective: 'reminder',
    personality: 'Friendly, clear, and reassuring',
    first_message: 'Hi [name], this is a reminder about your appointment on [date] at [time]. Can you confirm you\'ll be there?',
    system_prompt: `You are an appointment reminder agent for [clinic].
- Confirm attendance for upcoming appointments
- If they need to reschedule, offer available slots
- Provide prep instructions if needed
- Be HIPAA-compliant: don't share medical details on voicemail`,
    voicemail_message: 'Hi [name], this is a reminder for your appointment at [clinic] on [date].',
    category: 'Healthcare',
    tags: ['Healthcare', 'Reminders', 'English'],
  },
  {
    id: 'insurance-qualifier',
    name: 'Insurance Lead Qualification',
    language: 'en-US',
    languageLabel: 'English',
    objective: 'Qualify insurance leads and connect with agents',
    personality: 'Professional, trustworthy, thorough',
    first_message: 'Hello [name], I\'m calling about your insurance inquiry. Do you have a few minutes?',
    system_prompt: `You are an insurance lead qualifier for [company].
- Qualify: type of coverage, current provider, budget, urgency
- Explain benefits briefly
- Transfer qualified leads to a licensed agent`,
    voicemail_message: 'Hello [name], this is [company] following up on your insurance inquiry.',
    category: 'Insurance',
    tags: ['Insurance', 'English'],
  },
  {
    id: 'ecommerce-followup',
    name: 'E-commerce Post-Sale Follow Up',
    language: 'en-US',
    languageLabel: 'English',
    objective: 'retention',
    personality: 'Friendly, helpful, brand-positive',
    first_message: 'Hi [name], I\'m checking in about your recent purchase from [store]. How\'s everything going?',
    system_prompt: `You are a post-sale agent for [store].
- Check customer satisfaction
- Offer help with any issues
- Suggest complementary products if happy
- Handle returns or complaints professionally`,
    voicemail_message: 'Hi [name], this is [store] checking in after your recent order.',
    category: 'E-commerce',
    tags: ['E-commerce', 'Retention', 'English'],
  },
  {
    id: 'encuesta-satisfaccion',
    name: 'Encuestas de Satisfacción',
    language: 'es-MX',
    languageLabel: 'Español',
    objective: 'Recopilar feedback de clientes',
    personality: 'Amable, conciso y agradecido',
    first_message: 'Hola [nombre], ¿podría dedicarnos 2 minutos para una encuesta de satisfacción?',
    system_prompt: `Eres un agente de encuestas de [empresa].
- Haz máximo 5 preguntas breves
- Usa escala del 1 al 5 cuando sea posible
- Agradece el tiempo del cliente
- Si hay quejas, escala al equipo de soporte`,
    voicemail_message: 'Hola [nombre], llamamos de [empresa] para conocer su opinión. ¡Su feedback es muy valioso!',
    category: 'Survey',
    tags: ['Survey', 'Español'],
  },
  {
    id: 'saas-demo-booking',
    name: 'SaaS Demo Booking',
    language: 'en-US',
    languageLabel: 'English',
    objective: 'scheduling',
    personality: 'Enthusiastic, tech-savvy, concise',
    first_message: 'Hi [name], I\'d love to show you what [product] can do for you. Are you free for a 20-minute demo?',
    system_prompt: `You are a demo booking agent for [product].
- Lead with a key benefit relevant to their role
- Handle "not interested" by asking about their current solution
- Offer flexible demo times (morning/afternoon)
- Send calendar invite after confirming`,
    voicemail_message: 'Hi [name], this is [agent_name] from [product]. I\'d love to show you our platform.',
    category: 'SaaS',
    tags: ['SaaS', 'Demo', 'English'],
  },
];

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
  const [screen, setScreen] = useState<Screen>('templates');
  const [fromTemplate, setFromTemplate] = useState<AgentTemplate | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [gallerySearch, setGallerySearch] = useState('');

  // Wizard state
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState('');
  const [dynVars, setDynVars] = useState<{ key: string; value: string }[]>([]);

  // Workflow creation state
  const [workflowName, setWorkflowName] = useState('');
  const [workflowLanguage, setWorkflowLanguage] = useState('en-US');
  const [workflowSaving, setWorkflowSaving] = useState(false);

  const defaultForm = {
    name: '',
    language: 'en-US',
    auto_language_detection: false,
    voice_engine: 'standard' as 'standard' | 'ultra_fast' | 'premium',
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
  };

  const AUTOSAVE_KEY = 'voiceos:agent-draft';

  const [form, setForm] = useState(() => {
    // Restore autosaved draft if available
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(AUTOSAVE_KEY);
        if (saved) return { ...defaultForm, ...JSON.parse(saved) as Partial<typeof defaultForm> };
      } catch { /* ignore */ }
    }
    return defaultForm;
  });

  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saved'>('idle');

  useEffect(() => {
    if (screen !== 'simple') return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(form));
        setAutosaveStatus('saved');
        setTimeout(() => setAutosaveStatus('idle'), 2000);
      } catch { /* ignore */ }
    }, 1000);
    return () => clearTimeout(timer);
  }, [form, screen]);

  useEffect(() => {
    async function load() {
      const [wsRes, vRes] = await Promise.all([
        fetch('/api/admin/workspace-id'),
        fetch('/api/voices'),
      ]);
      if (wsRes.ok) {
        const d = await wsRes.json() as { workspace_id: string };
        setWorkspaceId(d.workspace_id ?? '');
      }
      if (vRes.ok) {
        const vData = await vRes.json() as { voices: Voice[] };
        setVoices(vData.voices ?? []);
        if (vData.voices?.[0]) {
          setForm((f) => ({ ...f, voice_id: vData.voices[0]!.voice_id, voice_name: vData.voices[0]!.name }));
        }
      }
    }
    load();
  }, []);

  function setField<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function updateDynVars(entries: { key: string; value: string }[]) {
    setDynVars(entries);
    const record: Record<string, string> = {};
    entries.filter(e => e.key).forEach(e => { record[e.key] = e.value; });
    setField('dynamic_variables', record);
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
    try {
      const proxied = `/api/voices/preview?url=${encodeURIComponent(voice.preview_url)}`;
      const audio = new Audio(proxied);
      audio.onended = () => setPlayingVoice(null);
      audio.onerror = () => setPlayingVoice(null);
      await audio.play();
    } catch {
      setPlayingVoice(null);
    }
  }

  function applyTemplate(tpl: AgentTemplate) {
    setFromTemplate(tpl);
    setForm((f) => ({
      ...f,
      name: tpl.name,
      language: tpl.language,
      objective: tpl.objective,
      personality: tpl.personality,
      system_prompt: tpl.system_prompt,
      first_message: tpl.first_message,
      voicemail_message: tpl.voicemail_message,
    }));
    setWorkflowName(tpl.name);
    setWorkflowLanguage(tpl.language);
    setShowGallery(false);
    setScreen('mode');
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
      localStorage.removeItem(AUTOSAVE_KEY);
      toast.success('Agent created!');
      router.push(`/agents/${agent.id}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleWorkflowCreate() {
    if (!workflowName.trim()) { toast.error('Agent name is required'); return; }
    setWorkflowSaving(true);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workflowName,
          language: workflowLanguage,
          workspace_id: workspaceId,
          voice_engine: 'retell',
          objective: fromTemplate?.objective ?? '',
          system_prompt: fromTemplate?.system_prompt ?? '',
          first_message: fromTemplate?.first_message ?? '',
          schedule_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          schedule_start_time: '09:00',
          schedule_end_time: '18:00',
          timezone: 'America/New_York',
          max_attempts: 3,
          retry_interval_minutes: 60,
        })
      });
      if (!res.ok) {
        const e = await res.json() as { error: string };
        throw new Error(e.error);
      }
      const agent = await res.json() as { id: string };
      toast.success('Workflow agent created!');
      router.push(`/agents/${agent.id}/flow`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setWorkflowSaving(false);
    }
  }

  const tokenCount = Math.ceil(form.system_prompt.length / 4);
  const filteredTemplates = AGENT_TEMPLATES.filter(t =>
    gallerySearch === '' ||
    t.name.toLowerCase().includes(gallerySearch.toLowerCase()) ||
    t.category.toLowerCase().includes(gallerySearch.toLowerCase()) ||
    t.tags.some(tag => tag.toLowerCase().includes(gallerySearch.toLowerCase()))
  );

  // ─── TEMPLATE SELECTION ────────────────────────────────────────────────────
  if (screen === 'templates') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f5f5f5]">
        <div className="w-full max-w-2xl">
          <button onClick={() => router.push('/agents')} className="flex items-center gap-1.5 text-sm text-[#6b6b6b] hover:text-[#0a0a0a] mb-8 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Agents
          </button>

          <div className="text-center mb-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#0a0a0a] text-white mx-auto mb-4">
              <Layers className="h-7 w-7" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0a0a0a]">New Agent</h1>
            <p className="mt-2 text-[#6b6b6b]">Start from a template or build from scratch</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card
              className="cursor-pointer border-2 hover:border-[#0a0a0a] transition-all hover:shadow-md"
              onClick={() => setShowGallery(true)}
            >
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5f5f5] border border-[#e0e0e0] mb-4">
                  <Layers className="h-6 w-6 text-[#0a0a0a]" />
                </div>
                <h2 className="font-bold text-[#0a0a0a] mb-1">Browse Templates</h2>
                <p className="text-xs text-[#6b6b6b] mb-4">
                  12 industry-specific templates ready to deploy in seconds.
                </p>
                <div className="flex flex-wrap gap-1 justify-center">
                  {['Sales', 'Support', 'Scheduling', 'B2B'].map(tag => (
                    <Badge key={tag} variant="outline" className="text-[10px] border-[#e0e0e0] text-[#6b6b6b]">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer border-2 hover:border-[#0a0a0a] transition-all hover:shadow-md"
              onClick={() => setScreen('mode')}
            >
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0a0a0a] mb-4">
                  <Plus className="h-6 w-6 text-white" />
                </div>
                <h2 className="font-bold text-[#0a0a0a] mb-1">Start from Scratch</h2>
                <p className="text-xs text-[#6b6b6b] mb-4">
                  Full control over every setting. Choose simple or workflow mode.
                </p>
                <Badge className="bg-[#0a0a0a] text-white border-transparent text-xs">Simple or Workflow</Badge>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Template Gallery Modal */}
        <Dialog open={showGallery} onOpenChange={setShowGallery}>
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Template Gallery</DialogTitle>
            </DialogHeader>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6b6b]" />
              <Input
                className="pl-9"
                placeholder="Search templates by name, category, or language…"
                value={gallerySearch}
                onChange={(e) => setGallerySearch(e.target.value)}
                autoFocus
              />
              {gallerySearch && (
                <button onClick={() => setGallerySearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-[#6b6b6b]" />
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-3 pb-2">
                {filteredTemplates.map((tpl) => (
                  <Card
                    key={tpl.id}
                    className="cursor-pointer hover:border-[#0a0a0a] transition-all hover:shadow-sm"
                    onClick={() => applyTemplate(tpl)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline" className="text-[10px] border-[#e0e0e0] text-[#6b6b6b]">
                          {tpl.languageLabel}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-[#e0e0e0] text-[#6b6b6b]">
                          {tpl.category}
                        </Badge>
                      </div>
                      <p className="font-semibold text-sm text-[#0a0a0a] mb-1">{tpl.name}</p>
                      <p className="text-xs text-[#6b6b6b] line-clamp-2">{tpl.first_message}</p>
                      <Button size="sm" variant="outline" className="w-full mt-3 text-xs">
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── MODE SELECTOR ────────────────────────────────────────────────────────
  if (screen === 'mode') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f5f5f5]">
        <div className="w-full max-w-2xl">
          <button onClick={() => setScreen('templates')} className="flex items-center gap-1.5 text-sm text-[#6b6b6b] hover:text-[#0a0a0a] mb-8 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          {fromTemplate && (
            <div className="flex items-center gap-2 rounded-md border border-[#e0e0e0] bg-white px-4 py-2.5 text-sm text-[#6b6b6b] mb-6">
              <Layers className="w-4 h-4 shrink-0" />
              Template: <span className="font-medium text-[#0a0a0a]">{fromTemplate.name}</span>
              <button onClick={() => { setFromTemplate(null); setForm(f => ({ ...f, ...defaultForm })); }} className="ml-auto">
                <X className="h-3.5 w-3.5 hover:text-[#0a0a0a]" />
              </button>
            </div>
          )}

          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-[#0a0a0a]">Choose Your Mode</h1>
            <p className="mt-2 text-[#6b6b6b]">How do you want to build your agent?</p>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <Card className="cursor-pointer border-2 hover:border-[#0a0a0a] transition-all hover:shadow-md" onClick={() => setScreen('simple')}>
              <CardContent className="p-7 flex flex-col items-start">
                <div className="flex items-center justify-between w-full mb-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0a0a0a] text-white">
                    <Zap className="h-6 w-6" />
                  </div>
                  <Badge className="bg-[#0a0a0a] text-white border-transparent text-xs">Recommended</Badge>
                </div>
                <h2 className="text-lg font-bold text-[#0a0a0a] mb-2">Simple Mode</h2>
                <p className="text-sm text-[#6b6b6b] mb-1 font-medium">Create your agent in 2 minutes</p>
                <p className="text-sm text-[#6b6b6b] mb-6">Write what your agent should do in plain language. Perfect for beginners.</p>
                <Button className="w-full mt-auto" onClick={() => setScreen('simple')}>Start Simple</Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer border-2 hover:border-[#0a0a0a] transition-all hover:shadow-md" onClick={() => setScreen('workflow')}>
              <CardContent className="p-7 flex flex-col items-start">
                <div className="flex items-center justify-between w-full mb-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5f5f5] border border-[#e0e0e0]">
                    <GitBranch className="h-6 w-6 text-[#0a0a0a]" />
                  </div>
                  <Badge variant="outline" className="text-xs border-[#e0e0e0] text-[#6b6b6b]">Advanced</Badge>
                </div>
                <h2 className="text-lg font-bold text-[#0a0a0a] mb-2">Workflow Mode</h2>
                <p className="text-sm text-[#6b6b6b] mb-1 font-medium">Build complex conversation flows</p>
                <p className="text-sm text-[#6b6b6b] mb-6">Design multi-step conversations with branches, conditions, and specialized sub-agents.</p>
                <Button variant="outline" className="w-full mt-auto" onClick={() => setScreen('workflow')}>Open Workflow Builder</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ─── WORKFLOW CREATION ────────────────────────────────────────────────────
  if (screen === 'workflow') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f5f5f5]">
        <div className="w-full max-w-md">
          <button onClick={() => setScreen('mode')} className="flex items-center gap-1.5 text-sm text-[#6b6b6b] hover:text-[#0a0a0a] mb-8 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="text-center mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#f5f5f5] border border-[#e0e0e0] mx-auto mb-4">
              <GitBranch className="h-7 w-7 text-[#0a0a0a]" />
            </div>
            <h1 className="text-2xl font-bold text-[#0a0a0a]">Workflow Agent</h1>
            <p className="mt-1 text-sm text-[#6b6b6b]">Name your agent, then design its conversation flow visually.</p>
          </div>
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-1.5">
                <Label>Agent Name *</Label>
                <Input
                  placeholder="e.g. Sales Flow Agent"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select value={workflowLanguage} onValueChange={setWorkflowLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleWorkflowCreate} disabled={workflowSaving || !workflowName.trim()}>
                {workflowSaving
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
                  : <><GitBranch className="mr-2 h-4 w-4" /> Create & Open Flow Builder</>
                }
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── SIMPLE MODE WIZARD ───────────────────────────────────────────────────
  return (
    <div className="p-6 mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => { setScreen('mode'); setStep(0); }} className="text-[#6b6b6b] hover:text-[#0a0a0a] transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Agent</h1>
          <p className="text-sm text-[#6b6b6b]">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {autosaveStatus === 'saved' && (
            <span className="text-xs text-[#6b6b6b]">Draft saved</span>
          )}
          <button
            onClick={() => { localStorage.removeItem(AUTOSAVE_KEY); setForm(defaultForm); toast.success('Draft cleared'); }}
            className="text-xs text-[#6b6b6b] hover:text-[#0a0a0a] underline underline-offset-2 transition-colors"
          >
            Clear draft
          </button>
        </div>
      </div>

      {fromTemplate && (
        <div className="flex items-center gap-2 rounded-md border border-[#e0e0e0] bg-[#f5f5f5] px-4 py-2.5 text-sm text-[#6b6b6b]">
          <Layers className="w-4 h-4 shrink-0" />
          Template: <span className="font-medium text-[#0a0a0a]">{fromTemplate.name}</span>
        </div>
      )}

      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-[#0a0a0a]' : 'bg-[#e0e0e0]'}`} />
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Agent Name *</Label>
              <Input placeholder="e.g. Sales SDR, Appointment Setter" value={form.name} onChange={(e) => setField('name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Language <FieldTooltip text="The primary language the agent will speak. This also controls the speech recognition model used during calls." /></Label>
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
                <Label>Auto Language Detection <FieldTooltip text="When enabled, the agent will detect the caller's language on the first turn and switch automatically. Useful for multilingual markets." /></Label>
                <p className="text-xs text-[#6b6b6b]">Detect and match the caller&apos;s language automatically</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Voice Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Voice</Label>
              <div className="max-h-64 overflow-y-auto rounded-md border border-[#e0e0e0]">
                {voices.length === 0 ? (
                  <div className="p-4 text-center text-sm text-[#6b6b6b]">Loading voices…</div>
                ) : voices.map((v) => (
                  <div key={v.voice_id} onClick={() => setForm((f) => ({ ...f, voice_id: v.voice_id, voice_name: v.name }))}
                    className={`flex items-center justify-between p-3 cursor-pointer border-b border-[#e0e0e0] last:border-b-0 transition-colors ${form.voice_id === v.voice_id ? 'bg-[#0a0a0a] text-white' : 'hover:bg-[#f5f5f5]'}`}>
                    <div>
                      <p className="text-sm font-medium">{v.name}</p>
                      <p className={`text-xs ${form.voice_id === v.voice_id ? 'text-[#aaa]' : 'text-[#6b6b6b]'}`}>
                        {v.labels?.['gender'] ?? ''} {v.labels?.['accent'] ? `· ${v.labels['accent']}` : ''}
                      </p>
                    </div>
                    {v.preview_url && (
                      <button onClick={(ev) => { ev.stopPropagation(); playPreview(v); }} className="p-1.5 rounded-md hover:bg-white/20">
                        {playingVoice === v.voice_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <Label>Emotional Controls <FieldTooltip text="Fine-tune how the agent sounds. Speed affects speaking pace, Pitch affects voice frequency, and Expressiveness controls emotional variation between sentences." /></Label>
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
                  <Slider min={min} max={max} step={s} value={[form[key]]} onValueChange={([v]) => setField(key, v ?? form[key])} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                <Label>System Prompt <FieldTooltip text="Instructions the AI follows throughout the call. Use [variable_name] placeholders for dynamic values like contact name or company. More detail = better performance." /></Label>
                <span className="text-xs text-[#6b6b6b]">~{tokenCount} tokens</span>
              </div>
              <Textarea rows={8} placeholder="You are a friendly sales representative for Acme Inc. Your goal is to..." value={form.system_prompt} onChange={(e) => setField('system_prompt', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>First Message <FieldTooltip text="The exact words the agent says when the call is answered. Keep it short and natural. Use [name] to personalize with the contact's name." /></Label>
              <Textarea rows={3} placeholder="Hello! I'm calling from Acme Inc. Is this a good time to talk?" value={form.first_message} onChange={(e) => setField('first_message', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Voicemail Message <FieldTooltip text="Spoken when the call goes to voicemail. Keep it under 30 seconds. Include a callback number or clear next step." /></Label>
              <Textarea rows={3} placeholder="Hi, I'm calling from Acme Inc. Please call us back at..." value={form.voicemail_message} onChange={(e) => setField('voicemail_message', e.target.value)} />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Call Schedule</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Active Days</Label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((d) => (
                  <button key={d.id} onClick={() => toggleDay(d.id)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${form.schedule_days.includes(d.id) ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white' : 'border-[#e0e0e0] hover:border-[#0a0a0a]'}`}>
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
                <Label>Max Attempts <FieldTooltip text="How many times the agent will call a contact if they don't answer. Each unanswered call counts. Recommended: 3–5." /></Label>
                <Input type="number" min={1} max={10} value={form.max_attempts} onChange={(e) => setField('max_attempts', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Retry Interval (min) <FieldTooltip text="Minutes to wait before calling a contact again after a no-answer. Minimum 15 minutes. Recommended: 60–240 minutes." /></Label>
                <Input type="number" min={15} value={form.retry_interval_minutes} onChange={(e) => setField('retry_interval_minutes', Number(e.target.value))} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader><CardTitle>Advanced Settings</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Branded Caller ID <FieldTooltip text="The name displayed on the recipient's phone screen. Requires CNAM registration with your phone provider. Leave blank to use the number." /></Label>
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
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Dynamic Variables <FieldTooltip text="Key-value pairs injected into your system prompt at call time. Reference them with [key_name] syntax. Example: key='company', value='Acme Inc.'." /></Label>
                  <p className="text-xs text-[#6b6b6b]">Variables injected into prompts at call time.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => updateDynVars([...dynVars, { key: '', value: '' }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {dynVars.map((entry, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input placeholder="key" value={entry.key} onChange={(e) => { const next = [...dynVars]; next[idx] = { ...next[idx]!, key: e.target.value }; updateDynVars(next); }} className="font-mono text-sm" />
                  <Input placeholder="value" value={entry.value} onChange={(e) => { const next = [...dynVars]; next[idx] = { ...next[idx]!, value: e.target.value }; updateDynVars(next); }} className="font-mono text-sm" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => updateDynVars(dynVars.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-3.5 w-3.5 text-[#6b6b6b]" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader><CardTitle>Review & Create</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-[#e0e0e0] divide-y divide-[#e0e0e0]">
              {[
                { label: 'Name', value: form.name },
                { label: 'Language', value: LANGUAGES.find((l) => l.value === form.language)?.label ?? form.language },
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
              The agent will be activated and ready to make calls immediately after creation.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="secondary" onClick={() => step > 0 ? setStep(step - 1) : setScreen('mode')} disabled={saving}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={step === 0 && !form.name}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
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
