'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import type { Integration, IntegrationType, IntegrationStatus } from '@/lib/supabase/types';
import { Link2, Link2Off, Webhook, RefreshCw, Send, CheckCircle2, Settings2 } from 'lucide-react';

// ── Integration catalogue ─────────────────────────────────────────────────────

type FormField = { id: string; label: string; placeholder: string; type?: 'password' | 'url' | 'text' };

interface IntegrationDef {
  type: IntegrationType;
  name: string;
  description: string;
  logo: string;
  docsUrl?: string;
  isWebhook?: boolean;
  comingSoon?: boolean;
  // If set, renders an inline credential form instead of a generic Connect button
  form?: FormField[];
  // Which credential fields map to webhook_url vs credentials JSON
  webhookField?: string;
}

const INTEGRATIONS: IntegrationDef[] = [
  // ── Notification / Automation ──────────────────────────────────────────────
  {
    type: 'telegram',
    name: 'Telegram',
    description: 'Receive call summaries and dispositions as Telegram messages after each call ends.',
    logo: '✈️',
    form: [
      { id: 'bot_token', label: 'Bot Token', placeholder: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', type: 'password' },
      { id: 'chat_id',   label: 'Chat ID',   placeholder: '-1001234567890 or @username' },
    ],
  },
  {
    type: 'teams',
    name: 'Microsoft Teams',
    description: 'Post call outcome cards to a Teams channel via an Incoming Webhook.',
    logo: 'T',
    form: [
      { id: 'webhook_url', label: 'Incoming Webhook URL', placeholder: 'https://org.webhook.office.com/...', type: 'url' },
    ],
    webhookField: 'webhook_url',
  },
  {
    type: 'n8n',
    name: 'n8n',
    description: 'Send the full call payload (transcript, summary, disposition, extracted data) to your n8n workflow.',
    logo: 'n8',
    form: [
      { id: 'webhook_url', label: 'Webhook URL', placeholder: 'https://your-n8n.cloud/webhook/...', type: 'url' },
    ],
    webhookField: 'webhook_url',
  },
  // ── Calendar ──────────────────────────────────────────────────────────────
  {
    type: 'google_calendar',
    name: 'Google Calendar',
    description: 'Auto-create calendar events when a call ends with disposition "Meeting Booked".',
    logo: '📅',
    comingSoon: false,
    form: [
      { id: 'client_id',     label: 'OAuth Client ID',     placeholder: 'xxxx.apps.googleusercontent.com' },
      { id: 'client_secret', label: 'OAuth Client Secret', placeholder: 'GOCSPX-...', type: 'password' },
      { id: 'refresh_token', label: 'Refresh Token',       placeholder: 'Obtain via Google OAuth Playground', type: 'password' },
    ],
  },
  // ── CRM ───────────────────────────────────────────────────────────────────
  {
    type: 'hubspot',
    name: 'HubSpot',
    description: 'Sync contacts and deals from HubSpot CRM.',
    logo: 'HS',
  },
  {
    type: 'gohighlevel',
    name: 'GoHighLevel',
    description: 'Integrate with GoHighLevel for CRM and automation.',
    logo: 'GHL',
    comingSoon: true,
  },
  {
    type: 'salesforce',
    name: 'Salesforce',
    description: 'Push call outcomes to Salesforce CRM records.',
    logo: 'SF',
    comingSoon: true,
  },
  // ── Automation platforms ───────────────────────────────────────────────────
  {
    type: 'zapier',
    name: 'Zapier',
    description: 'Automate workflows with 5,000+ apps via Zapier.',
    logo: 'ZAP',
    comingSoon: true,
  },
  {
    type: 'make',
    name: 'Make',
    description: 'Build advanced automations with Make (Integromat).',
    logo: 'MK',
    comingSoon: true,
  },
  {
    type: 'calendly',
    name: 'Calendly',
    description: 'Book meetings during calls using Calendly.',
    logo: 'CAL',
    comingSoon: true,
  },
  // ── Custom webhook ─────────────────────────────────────────────────────────
  {
    type: 'webhook',
    name: 'Custom Webhook',
    description: 'Send real-time event notifications to your endpoint. Manage multiple endpoints →',
    logo: 'WH',
    isWebhook: true,
  },
];

const WEBHOOK_EVENTS = [
  { id: 'call.completed',      label: 'Call Completed' },
  { id: 'call.converted',      label: 'Call Converted' },
  { id: 'call.failed',         label: 'Call Failed' },
  { id: 'campaign.started',    label: 'Campaign Started' },
  { id: 'campaign.completed',  label: 'Campaign Completed' },
  { id: 'contact.created',     label: 'Contact Created' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: IntegrationStatus | null) {
  if (!status || status === 'disconnected') {
    return <Badge className="border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs">Disconnected</Badge>;
  }
  return (
    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs flex items-center gap-1">
      <CheckCircle2 className="w-3 h-3" />
      Connected
    </Badge>
  );
}

// ── Inline form card for credential-based integrations ────────────────────────

function CredentialCard({
  def,
  integration,
  onSave,
  onDisconnect,
}: {
  def: IntegrationDef;
  integration: Integration | null;
  onSave: (type: IntegrationType, fields: Record<string, string>) => Promise<void>;
  onDisconnect: (type: IntegrationType) => Promise<void>;
}) {
  const isConnected = integration?.status === 'connected';
  const creds = (integration?.credentials ?? {}) as Record<string, string>;

  // Initialise form from saved credentials
  const initial: Record<string, string> = {};
  def.form!.forEach((f) => { initial[f.id] = creds[f.id] ?? ''; });

  const [fields, setFields] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(!isConnected);

  async function save() {
    setSaving(true);
    await onSave(def.type, fields);
    setSaving(false);
    setExpanded(false);
  }

  async function disconnect() {
    setSaving(true);
    await onDisconnect(def.type);
    setSaving(false);
    setExpanded(false);
  }

  const logoIsEmoji = /\p{Emoji}/u.test(def.logo);

  return (
    <Card className={isConnected ? 'border-emerald-300' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg border flex items-center justify-center text-sm font-bold
              ${isConnected ? 'bg-emerald-50 border-emerald-200' : 'bg-[#f5f5f5] border-[#e0e0e0]'}
              ${logoIsEmoji ? 'text-xl' : 'text-[#0a0a0a] text-xs'}`}>
              {def.logo}
            </div>
            <div>
              <CardTitle className="text-sm">{def.name}</CardTitle>
              {statusBadge(integration?.status ?? null)}
            </div>
          </div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-[#6b6b6b] hover:text-[#0a0a0a] p-1 rounded"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="text-xs leading-relaxed mb-3">{def.description}</CardDescription>

        {expanded && (
          <div className="space-y-3 border-t border-[#e0e0e0] pt-3">
            {def.form!.map((f) => (
              <div key={f.id} className="space-y-1">
                <Label htmlFor={`${def.type}-${f.id}`} className="text-xs">{f.label}</Label>
                <Input
                  id={`${def.type}-${f.id}`}
                  type={f.type ?? 'text'}
                  placeholder={f.placeholder}
                  value={fields[f.id] ?? ''}
                  onChange={(e) => setFields(prev => ({ ...prev, [f.id]: e.target.value }))}
                  className="text-xs h-8"
                />
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 text-xs"
                disabled={saving || !def.form!.every(f => fields[f.id]?.trim())}
                onClick={save}
              >
                {saving ? 'Saving…' : isConnected ? 'Update' : 'Connect'}
              </Button>
              {isConnected && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  disabled={saving}
                  onClick={disconnect}
                >
                  <Link2Off className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>

            {def.type === 'telegram' && (
              <p className="text-[10px] text-[#6b6b6b] leading-relaxed">
                Create a bot via @BotFather → copy the token. Add the bot to your group/channel and get the Chat ID from the Telegram API or a bot like @userinfobot.
              </p>
            )}
            {(def.type === 'teams') && (
              <p className="text-[10px] text-[#6b6b6b] leading-relaxed">
                In Teams: channel → ⋯ → Connectors → Incoming Webhook → copy the URL.
              </p>
            )}
            {def.type === 'n8n' && (
              <p className="text-[10px] text-[#6b6b6b] leading-relaxed">
                In n8n: add a Webhook trigger node → copy the "Test URL" or "Production URL". The full call payload (transcript, summary, disposition, extracted data) will be POSTed on every analyzed call.
              </p>
            )}
            {def.type === 'google_calendar' && (
              <p className="text-[10px] text-[#6b6b6b] leading-relaxed">
                Create OAuth credentials in Google Cloud Console (scope: calendar.events). Use the OAuth Playground to generate a refresh token. Events are created automatically when disposition = Meeting Booked.
              </p>
            )}
          </div>
        )}

        {!expanded && isConnected && (
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-600">
            <CheckCircle2 className="w-3 h-3" />
            Active — notifications will fire after each call analysis
          </div>
        )}

        {!expanded && !isConnected && (
          <Button size="sm" className="w-full text-xs mt-1" onClick={() => setExpanded(true)}>
            <Link2 className="w-3.5 h-3.5 mr-1.5" />
            Configure
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Generic connect/disconnect card ──────────────────────────────────────────

function GenericCard({
  def,
  integration,
  onConnect,
  onDisconnect,
  busy,
}: {
  def: IntegrationDef;
  integration: Integration | null;
  onConnect: (type: IntegrationType) => void;
  onDisconnect: (type: IntegrationType) => void;
  busy: boolean;
}) {
  const isConnected = integration?.status === 'connected';
  const logoIsEmoji = /\p{Emoji}/u.test(def.logo);

  return (
    <Card className={isConnected ? 'border-[#0a0a0a]' : def.comingSoon ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-[#f5f5f5] border border-[#e0e0e0] flex items-center justify-center
              ${logoIsEmoji ? 'text-xl' : 'text-xs font-bold text-[#0a0a0a]'}`}>
              {def.logo}
            </div>
            <div>
              <CardTitle className="text-sm">{def.name}</CardTitle>
              {def.comingSoon
                ? <Badge className="text-xs border-[#e0e0e0] text-[#6b6b6b] bg-white">Coming Soon</Badge>
                : statusBadge(integration?.status ?? null)
              }
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="mb-4 text-xs leading-relaxed">{def.description}</CardDescription>
        {def.comingSoon ? (
          <Button size="sm" className="w-full text-xs" disabled>Coming Soon</Button>
        ) : isConnected ? (
          <Button variant="outline" size="sm" className="w-full text-xs" disabled={busy} onClick={() => onDisconnect(def.type)}>
            <Link2Off className="w-3.5 h-3.5 mr-1.5" />
            {busy ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        ) : (
          <Button size="sm" className="w-full text-xs" disabled={busy} onClick={() => onConnect(def.type)}>
            <Link2 className="w-3.5 h-3.5 mr-1.5" />
            {busy ? 'Connecting…' : 'Connect'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Record<IntegrationType, Integration | null>>({} as Record<IntegrationType, Integration | null>);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<IntegrationType | null>(null);
  const [workspaceId, setWorkspaceId] = useState('');

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [savingWebhook, setSavingWebhook] = useState(false);

  // Load workspace ID
  useEffect(() => {
    fetch('/api/admin/workspace-id')
      .then(r => r.json())
      .then((d: { workspace_id: string }) => setWorkspaceId(d.workspace_id ?? ''))
      .catch(() => {});
  }, []);

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/integrations');
    if (res.ok) {
      const d = await res.json() as { integrations: Integration[] };
      const map: Record<string, Integration | null> = {};
      INTEGRATIONS.forEach(i => { map[i.type] = null; });
      (d.integrations ?? []).forEach(i => { map[i.type] = i; });
      setIntegrations(map as Record<IntegrationType, Integration | null>);

      const webhook = (d.integrations ?? []).find(i => i.type === 'webhook');
      if (webhook) {
        setWebhookUrl(webhook.webhook_url ?? '');
        setWebhookEvents(webhook.webhook_events ?? []);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchIntegrations(); }, [fetchIntegrations]);

  // ── Generic connect/disconnect (OAuth-style) ─────────────────────────────
  async function connect(type: IntegrationType) {
    setConnecting(type);
    const res = await fetch('/api/integrations/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    if (res.ok) {
      const d = await res.json() as { redirect_url?: string };
      if (d.redirect_url) { window.location.href = d.redirect_url; return; }
      await fetchIntegrations();
    }
    setConnecting(null);
  }

  async function disconnect(type: IntegrationType) {
    setConnecting(type);
    await fetch('/api/integrations/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    await fetchIntegrations();
    setConnecting(null);
  }

  // ── Credential form save (for Telegram, Teams, n8n, Google Calendar) ─────
  async function saveCredentials(type: IntegrationType, fields: Record<string, string>) {
    const def = INTEGRATIONS.find(i => i.type === type)!;
    const webhookFieldId = def.webhookField;

    const credentials: Record<string, string> = {};
    let webhook_url: string | null = null;

    for (const [k, v] of Object.entries(fields)) {
      if (k === webhookFieldId) webhook_url = v;
      else credentials[k] = v;
    }
    // For Teams/n8n where all data is a URL, also store in credentials for redundancy
    if (webhookFieldId && fields[webhookFieldId]) {
      credentials[webhookFieldId] = fields[webhookFieldId]!;
    }

    await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: workspaceId,
        type,
        status: 'connected',
        credentials,
        webhook_url,
      }),
    });
    await fetchIntegrations();
  }

  async function disconnectCredential(type: IntegrationType) {
    await fetch('/api/integrations/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    await fetchIntegrations();
  }

  async function saveWebhook() {
    setSavingWebhook(true);
    await fetch('/api/integrations/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhook_url: webhookUrl, webhook_events: webhookEvents }),
    });
    await fetchIntegrations();
    setSavingWebhook(false);
  }

  function toggleWebhookEvent(eventId: string) {
    setWebhookEvents(prev =>
      prev.includes(eventId) ? prev.filter(e => e !== eventId) : [...prev, eventId]
    );
  }

  // Separate integrations into categories
  const credentialTypes = new Set(['telegram', 'teams', 'n8n', 'google_calendar']);
  const notifAndAutomation = INTEGRATIONS.filter(i => !i.isWebhook && !i.comingSoon && credentialTypes.has(i.type));
  const crmAndOthers = INTEGRATIONS.filter(i => !i.isWebhook && !credentialTypes.has(i.type));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Integrations</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            Connect your tools. Post-call events fire automatically after every analyzed call.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchIntegrations} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* ── Notifications & Automation (credential-based) ────────────────────── */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-[#6b6b6b] uppercase tracking-wide mb-3 flex items-center gap-2">
          <Send className="w-3.5 h-3.5" />
          Post-Call Notifications &amp; Automation
        </h2>
        <p className="text-xs text-[#6b6b6b] mb-4">
          These integrations fire automatically after each call is analyzed — no extra work required.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-44 bg-[#f5f5f5] rounded-xl animate-pulse" />
              ))
            : notifAndAutomation.map((def) => (
                <CredentialCard
                  key={def.type}
                  def={def}
                  integration={integrations[def.type] ?? null}
                  onSave={saveCredentials}
                  onDisconnect={disconnectCredential}
                />
              ))
          }
        </div>
      </div>

      <Separator className="my-6" />

      {/* ── CRM & Other ──────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-[#6b6b6b] uppercase tracking-wide mb-3">
          CRM &amp; Platforms
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-44 bg-[#f5f5f5] rounded-xl animate-pulse" />
              ))
            : crmAndOthers.filter(i => !i.isWebhook).map((def) => (
                <GenericCard
                  key={def.type}
                  def={def}
                  integration={integrations[def.type] ?? null}
                  onConnect={connect}
                  onDisconnect={disconnect}
                  busy={connecting === def.type}
                />
              ))
          }
        </div>
      </div>

      <Separator className="my-6" />

      {/* ── Custom Webhook ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#f5f5f5] border border-[#e0e0e0] flex items-center justify-center">
              <Webhook className="w-5 h-5 text-[#0a0a0a]" />
            </div>
            <div>
              <CardTitle className="text-sm">Custom Webhook</CardTitle>
              <CardDescription className="text-xs">
                Receive real-time POST events to any endpoint. Manage multiple endpoints →
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://your-server.com/webhooks/voiceos"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <p className="text-xs text-[#6b6b6b]">
                We'll POST a JSON payload for each selected event.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="grid grid-cols-2 gap-2">
                {WEBHOOK_EVENTS.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`ev-${ev.id}`}
                      checked={webhookEvents.includes(ev.id)}
                      onCheckedChange={() => toggleWebhookEvent(ev.id)}
                    />
                    <Label htmlFor={`ev-${ev.id}`} className="text-xs font-normal cursor-pointer">
                      {ev.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={saveWebhook} disabled={savingWebhook || !webhookUrl.trim()}>
              {savingWebhook ? 'Saving…' : 'Save Webhook'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
