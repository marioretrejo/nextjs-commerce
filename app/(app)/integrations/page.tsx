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
import { Link2, Link2Off, Webhook, RefreshCw } from 'lucide-react';

interface IntegrationDef {
  type: IntegrationType;
  name: string;
  description: string;
  logo: string;
  docsUrl: string;
  isWebhook?: boolean;
  comingSoon?: boolean;
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    type: 'hubspot',
    name: 'HubSpot',
    description: 'Sync contacts and deals from HubSpot CRM.',
    logo: 'HS',
    docsUrl: 'https://developers.hubspot.com',
  },
  {
    type: 'gohighlevel',
    name: 'GoHighLevel',
    description: 'Integrate with GoHighLevel for CRM and automation.',
    logo: 'GHL',
    docsUrl: 'https://highlevel.stoplight.io',
    comingSoon: true,
  },
  {
    type: 'salesforce',
    name: 'Salesforce',
    description: 'Push call outcomes to Salesforce CRM records.',
    logo: 'SF',
    docsUrl: 'https://developer.salesforce.com',
    comingSoon: true,
  },
  {
    type: 'zapier',
    name: 'Zapier',
    description: 'Automate workflows with 5,000+ apps via Zapier.',
    logo: 'ZAP',
    docsUrl: 'https://zapier.com/apps',
    comingSoon: true,
  },
  {
    type: 'make',
    name: 'Make',
    description: 'Build advanced automations with Make (Integromat).',
    logo: 'MK',
    docsUrl: 'https://www.make.com/en/api-documentation',
    comingSoon: true,
  },
  {
    type: 'calendly',
    name: 'Calendly',
    description: 'Book meetings during calls using Calendly.',
    logo: 'CAL',
    docsUrl: 'https://developer.calendly.com',
    comingSoon: true,
  },
  {
    type: 'google_calendar',
    name: 'Google Calendar',
    description: 'Schedule events directly from call outcomes.',
    logo: 'GC',
    docsUrl: 'https://developers.google.com/calendar',
    comingSoon: true,
  },
  {
    type: 'webhook',
    name: 'Webhook',
    description: 'Send real-time event notifications to your endpoint. Manage multiple endpoints →',
    logo: 'WH',
    docsUrl: '/integrations/webhooks',
    isWebhook: true,
  },
];

const WEBHOOK_EVENTS = [
  { id: 'call.completed',  label: 'Call Completed' },
  { id: 'call.converted',  label: 'Call Converted' },
  { id: 'call.failed',     label: 'Call Failed' },
  { id: 'campaign.started',   label: 'Campaign Started' },
  { id: 'campaign.completed', label: 'Campaign Completed' },
  { id: 'contact.created',    label: 'Contact Created' },
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Record<IntegrationType, Integration | null>>({} as Record<IntegrationType, Integration | null>);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<IntegrationType | null>(null);

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [savingWebhook, setSavingWebhook] = useState(false);

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

  async function connect(type: IntegrationType) {
    setConnecting(type);
    const res = await fetch('/api/integrations/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    if (res.ok) {
      const d = await res.json() as { redirect_url?: string };
      if (d.redirect_url) {
        window.location.href = d.redirect_url;
        return;
      }
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

  function statusBadge(status: IntegrationStatus | null) {
    if (!status || status === 'disconnected') {
      return <Badge className="border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs">Disconnected</Badge>;
    }
    return <Badge className="bg-[#0a0a0a] text-white border-transparent text-xs">Connected</Badge>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Integrations</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">Connect your tools and automate workflows with VoiceOS.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchIntegrations} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {INTEGRATIONS.filter(i => !i.isWebhook).map((def) => {
          const integration = integrations[def.type];
          const isConnected = integration?.status === 'connected';
          const isBusy = connecting === def.type;

          return (
            <Card key={def.type} className={isConnected ? 'border-[#0a0a0a]' : def.comingSoon ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#f5f5f5] border border-[#e0e0e0] flex items-center justify-center text-xs font-bold text-[#0a0a0a]">
                      {def.logo}
                    </div>
                    <div>
                      <CardTitle className="text-sm">{def.name}</CardTitle>
                      {def.comingSoon ? (
                        <Badge className="text-xs border-[#e0e0e0] text-[#6b6b6b] bg-white">Coming Soon</Badge>
                      ) : !loading ? (
                        statusBadge(integration?.status ?? null)
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="mb-4 text-xs leading-relaxed">
                  {def.description}
                </CardDescription>
                {def.comingSoon ? (
                  <Button size="sm" className="w-full text-xs" disabled>
                    Coming Soon
                  </Button>
                ) : loading ? (
                  <div className="h-8 bg-[#f5f5f5] rounded animate-pulse" />
                ) : isConnected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    disabled={isBusy}
                    onClick={() => disconnect(def.type)}
                  >
                    <Link2Off className="w-3.5 h-3.5 mr-1.5" />
                    {isBusy ? 'Disconnecting…' : 'Disconnect'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full text-xs"
                    disabled={isBusy}
                    onClick={() => connect(def.type)}
                  >
                    <Link2 className="w-3.5 h-3.5 mr-1.5" />
                    {isBusy ? 'Connecting…' : 'Connect'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Webhook card — spans full width in a 3-col grid on its own row */}
        <Card className="col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#f5f5f5] border border-[#e0e0e0] flex items-center justify-center">
                <Webhook className="w-5 h-5 text-[#0a0a0a]" />
              </div>
              <div>
                <CardTitle className="text-sm">Webhook</CardTitle>
                <CardDescription className="text-xs">
                  Receive real-time POST events to your endpoint.
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
                  We'll send a POST request with a JSON payload for each selected event.
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
              <Button
                size="sm"
                onClick={saveWebhook}
                disabled={savingWebhook || !webhookUrl.trim()}
              >
                {savingWebhook ? 'Saving…' : 'Save Webhook'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
