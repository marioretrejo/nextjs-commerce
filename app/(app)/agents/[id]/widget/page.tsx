'use client';

import { use, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Check, Copy, Loader2, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface WidgetConfig {
  button_text: string;
  button_color: string;
  position: 'bottom-right' | 'bottom-left';
}

export default function WidgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [config, setConfig] = useState<WidgetConfig>({
    button_text: 'Talk to us',
    button_color: '#0a0a0a',
    position: 'bottom-right',
  });
  const [copied, setCopied] = useState<'iframe' | 'script' | null>(null);

  useEffect(() => {
    fetch(`/api/agents/${id}/widget-config`)
      .then(r => r.json())
      .then((d: { name?: string; widget_config?: WidgetConfig }) => {
        setAgentName(d.name ?? '');
        if (d.widget_config) setConfig(d.widget_config);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${id}/widget-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widget_config: config }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Widget config saved');
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const iframeCode = `<iframe src="${appUrl}/widget/${id}" width="400" height="600" frameborder="0" allow="microphone"></iframe>`;
  const scriptCode = `<script src="${appUrl}/widget.js" data-agent-id="${id}" data-text="${config.button_text}" data-color="${config.button_color}" data-position="${config.position}"></script>`;

  function copy(type: 'iframe' | 'script') {
    navigator.clipboard.writeText(type === 'iframe' ? iframeCode : scriptCode);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/agents/${id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Web Chat Widget</h1>
          <p className="text-sm text-[#6b6b6b]">{agentName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Config */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customization</CardTitle>
              <CardDescription>Configure how the widget looks on your website.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Button Text</Label>
                <Input
                  value={config.button_text}
                  onChange={e => setConfig(c => ({ ...c, button_text: e.target.value }))}
                  placeholder="Talk to us"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Button Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.button_color}
                    onChange={e => setConfig(c => ({ ...c, button_color: e.target.value }))}
                    className="h-9 w-14 cursor-pointer rounded border border-[#e0e0e0]"
                  />
                  <Input
                    value={config.button_color}
                    onChange={e => setConfig(c => ({ ...c, button_color: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Position</Label>
                <select
                  value={config.position}
                  onChange={e => setConfig(c => ({ ...c, position: e.target.value as WidgetConfig['position'] }))}
                  className="w-full h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                </select>
              </div>
              <Button onClick={save} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Save Configuration
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>How the widget appears on your website.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-48 rounded-lg bg-[#f5f5f5] border border-[#e0e0e0] overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center text-[#6b6b6b] text-sm">
                  Your website content
                </div>
                <div
                  className={`absolute bottom-4 ${config.position === 'bottom-right' ? 'right-4' : 'left-4'}`}
                >
                  <button
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-white text-sm font-medium shadow-lg"
                    style={{ backgroundColor: config.button_color }}
                  >
                    <MessageSquare className="h-4 w-4" />
                    {config.button_text}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Embed codes */}
      <Card>
        <CardHeader>
          <CardTitle>Embed Code</CardTitle>
          <CardDescription>Add one of these snippets to your website's HTML.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>iFrame Embed</Label>
              <Button variant="ghost" size="sm" onClick={() => copy('iframe')}>
                {copied === 'iframe' ? <Check className="h-3.5 w-3.5 mr-1 text-green-600" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copied === 'iframe' ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <pre className="rounded-lg bg-[#f5f5f5] p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {iframeCode}
            </pre>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Script Tag</Label>
              <Button variant="ghost" size="sm" onClick={() => copy('script')}>
                {copied === 'script' ? <Check className="h-3.5 w-3.5 mr-1 text-green-600" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copied === 'script' ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <pre className="rounded-lg bg-[#f5f5f5] p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {scriptCode}
            </pre>
          </div>
          <p className="text-xs text-[#6b6b6b]">
            The widget requires microphone access. Ensure your website is served over HTTPS.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
