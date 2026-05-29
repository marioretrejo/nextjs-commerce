'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Webhook, Plus, Trash2, Pencil, Copy, Check, AlertTriangle,
  CheckCircle2, XCircle, RefreshCw, ChevronRight, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

const ALL_EVENTS = [
  { value: 'call.completed',       label: 'Call Completed',       description: 'Fires when a call ends — includes transcript, recording URL, and analysis' },
  { value: 'call.started',         label: 'Call Started',         description: 'Fires when a new room is created' },
  { value: 'call.failed',          label: 'Call Failed',          description: 'Fires when Twilio reports a failure or no-answer' },
  { value: 'campaign.run_complete',label: 'Campaign Completed',   description: 'Fires when a batch campaign finishes all dials' },
];

interface Endpoint {
  id:                       string;
  url:                      string;
  events:                   string[];
  description:              string | null;
  is_active:                boolean;
  last_delivery_at:         string | null;
  last_delivery_status:     string | null;
  last_delivery_status_code:number | null;
  created_at:               string;
}

function SecretBlock({ secret, onDone }: { secret: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
        <div className="text-sm text-red-700">
          <p className="font-bold">Copy this secret now.</p>
          <p className="text-xs mt-0.5">For security, it will not be shown again. Store it in your password manager or environment variables.</p>
        </div>
      </div>
      <div className="relative rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] p-3 font-mono text-xs text-[#0a0a0a] break-all pr-10">
        {secret}
        <button
          onClick={copy}
          className="absolute right-2 top-2 rounded p-1 hover:bg-[#e8e8e8] transition-colors"
          title="Copy secret"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-[#6b6b6b]" />}
        </button>
      </div>
      <p className="text-xs text-[#6b6b6b]">
        Use this secret to verify the <code className="bg-[#f0f0f0] px-1 rounded">X-VoiceOS-Signature</code> header on incoming webhook requests.
        Format: <code className="bg-[#f0f0f0] px-1 rounded">t=&#123;ts&#125;,v1=&#123;hmac-sha256&#125;</code>
      </p>
      <Button size="sm" onClick={onDone} className="w-full">
        I've saved the secret
      </Button>
    </div>
  );
}

function AddWebhookModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (endpoint: Endpoint & { secret: string }) => void;
}) {
  const [url, setUrl]             = useState('');
  const [events, setEvents]       = useState<string[]>(['call.completed']);
  const [description, setDescription] = useState('');
  const [loading, setLoading]     = useState(false);
  const [secret, setSecret]       = useState<string | null>(null);
  const [created, setCreated]     = useState<Endpoint | null>(null);

  function toggleEvent(value: string) {
    setEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url || !events.length) return;
    setLoading(true);
    try {
      const res = await fetch('/api/webhooks/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, events, description: description || undefined }),
      });
      const data = await res.json() as (Endpoint & { secret: string }) | { error: string };
      if (!res.ok) { toast.error((data as { error: string }).error); return; }
      const row = data as Endpoint & { secret: string };
      setSecret(row.secret);
      setCreated(row);
      onCreated(row);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setUrl(''); setEvents(['call.completed']); setDescription('');
    setSecret(null); setCreated(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4" /> Add Webhook Endpoint
          </DialogTitle>
          <DialogDescription className="text-xs text-[#6b6b6b]">
            VoiceOS will POST signed JSON events to your endpoint URL.
          </DialogDescription>
        </DialogHeader>

        {secret && created ? (
          <SecretBlock secret={secret} onDone={handleClose} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#0a0a0a]" htmlFor="wh-url">
                Endpoint URL <span className="text-red-500">*</span>
              </label>
              <input
                id="wh-url"
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-app.com/webhooks/voiceos"
                className="w-full h-9 rounded-lg border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] placeholder:text-[#c0c0c0] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/20 focus:border-[#0a0a0a]"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#0a0a0a]" htmlFor="wh-desc">
                Description <span className="text-[#a0a0a0] font-normal">(optional)</span>
              </label>
              <input
                id="wh-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Zapier bridge, HubSpot CRM sync"
                className="w-full h-9 rounded-lg border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] placeholder:text-[#c0c0c0] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/20 focus:border-[#0a0a0a]"
              />
            </div>

            {/* Events */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#0a0a0a]">Events to subscribe to</p>
              <div className="space-y-2">
                {ALL_EVENTS.map((ev) => (
                  <label key={ev.value} className="flex items-start gap-3 cursor-pointer rounded-lg border border-[#e5e5e5] p-3 hover:bg-[#fafafa] transition-colors">
                    <input
                      type="checkbox"
                      checked={events.includes(ev.value)}
                      onChange={() => toggleEvent(ev.value)}
                      className="mt-0.5 h-3.5 w-3.5 accent-[#0a0a0a] shrink-0"
                    />
                    <div>
                      <p className="text-xs font-medium text-[#0a0a0a]">{ev.label}</p>
                      <p className="text-[11px] text-[#6b6b6b] mt-0.5">{ev.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              {events.length === 0 && (
                <p className="text-xs text-red-500">Select at least one event.</p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading || !url || events.length === 0}>
                {loading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Creating…</> : 'Create Endpoint'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeliveryBadge({ status, code }: { status: string | null; code: number | null }) {
  if (!status) return <span className="text-xs text-[#a0a0a0]">Never delivered</span>;
  if (status === 'success') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> {code ?? 200}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-red-700">
      <XCircle className="h-3.5 w-3.5" /> {code ? `Error ${code}` : 'Failed'}
    </span>
  );
}

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading]     = useState(true);
  const [addOpen, setAddOpen]     = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [toggling, setToggling]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/webhooks/endpoints');
      const json = await res.json() as { data: Endpoint[] };
      setEndpoints(json.data ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function handleCreated(ep: Endpoint & { secret: string }) {
    setEndpoints((prev) => [{ ...ep }, ...prev]);
  }

  async function deleteEndpoint(id: string, url: string) {
    if (!confirm(`Delete webhook endpoint?\n${url}`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/webhooks/endpoints/${id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete.'); return; }
      setEndpoints((prev) => prev.filter((e) => e.id !== id));
      toast.success('Endpoint deleted.');
    } catch (err) { toast.error(String(err)); }
    finally { setDeleting(null); }
  }

  async function toggleActive(ep: Endpoint) {
    setToggling(ep.id);
    try {
      const res = await fetch(`/api/webhooks/endpoints/${ep.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !ep.is_active }),
      });
      if (!res.ok) { toast.error('Failed to update.'); return; }
      setEndpoints((prev) => prev.map((e) => e.id === ep.id ? { ...e, is_active: !ep.is_active } : e));
    } catch (err) { toast.error(String(err)); }
    finally { setToggling(null); }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-[#a0a0a0]">
        <Link href="/integrations" className="hover:text-[#0a0a0a] transition-colors">Integrations</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-[#0a0a0a] font-medium">Webhooks</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0a0a0a] flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Endpoints
          </h1>
          <p className="text-sm text-[#6b6b6b] mt-0.5">
            VoiceOS sends signed HTTP POST requests to your endpoints when events occur.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="rounded-lg border border-[#e5e5e5] p-2 hover:bg-[#f5f5f5] transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 text-[#6b6b6b] ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Endpoint
          </Button>
        </div>
      </div>

      {/* How it works */}
      <Card className="bg-[#fafafa] border-[#e5e5e5]">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-xs">
            {[
              { step: '1', title: 'Event fires', body: 'A call ends, campaign completes, or another subscribed event occurs.' },
              { step: '2', title: 'Signed POST', body: 'VoiceOS sends a JSON payload to your URL with X-VoiceOS-Signature for verification.' },
              { step: '3', title: 'You respond', body: 'Return any 2xx status within 30s. Failed deliveries are retried up to 3 times.' },
            ].map((s) => (
              <div key={s.step} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] text-[10px] font-bold text-white">{s.step}</span>
                <div>
                  <p className="font-semibold text-[#0a0a0a]">{s.title}</p>
                  <p className="text-[#6b6b6b] mt-0.5">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Endpoints table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-[#a0a0a0]">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading endpoints…
        </div>
      ) : endpoints.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e0e0e0] py-16 text-center">
          <Webhook className="h-8 w-8 text-[#d0d0d0] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#0a0a0a]">No webhook endpoints yet</p>
          <p className="text-xs text-[#6b6b6b] mt-1 mb-4">
            Add your first endpoint to start receiving call data in your CRM or automation tool.
          </p>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Endpoint
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {endpoints.map((ep) => (
            <Card key={ep.id} className={`border-[#e5e5e5] ${!ep.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-[#0a0a0a] truncate">{ep.url}</span>
                      <Badge
                        variant={ep.is_active ? 'default' : 'secondary'}
                        className={`text-[10px] ${ep.is_active ? 'bg-green-600 text-white border-transparent' : ''}`}
                      >
                        {ep.is_active ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>

                    {ep.description && (
                      <p className="text-xs text-[#6b6b6b] mt-0.5">{ep.description}</p>
                    )}

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {ep.events.map((ev) => (
                        <span key={ev} className="rounded-md bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-mono text-[#4a4a4a]">
                          {ev}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-[#a0a0a0]">
                      <span>Added {format(new Date(ep.created_at), 'MMM d, yyyy')}</span>
                      {ep.last_delivery_at && (
                        <span>Last delivery {format(new Date(ep.last_delivery_at), 'MMM d, HH:mm')}</span>
                      )}
                      <DeliveryBadge status={ep.last_delivery_status} code={ep.last_delivery_status_code} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleActive(ep)}
                      disabled={toggling === ep.id}
                      className="rounded-lg border border-[#e5e5e5] px-2.5 py-1.5 text-xs text-[#6b6b6b] hover:bg-[#f5f5f5] transition-colors disabled:opacity-50"
                      title={ep.is_active ? 'Disable' : 'Enable'}
                    >
                      {toggling === ep.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : ep.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => deleteEndpoint(ep.id, ep.url)}
                      disabled={deleting === ep.id}
                      className="rounded-lg border border-[#e5e5e5] p-1.5 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Delete endpoint"
                    >
                      {deleting === ep.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddWebhookModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
