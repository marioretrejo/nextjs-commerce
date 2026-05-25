'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

interface WorkspaceBranding {
  primary_color: string;
  logo_url: string | null;
  app_name: string;
  custom_css?: string | null;
}

export default function WorkspaceBrandingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [branding, setBranding] = useState<WorkspaceBranding>({
    primary_color: '#0a0a0a',
    logo_url: null,
    app_name: 'VoiceOS',
    custom_css: null,
  });

  useEffect(() => {
    fetch('/api/workspace/branding')
      .then(r => r.json())
      .then((d: { name?: string; branding?: WorkspaceBranding }) => {
        setWorkspaceName(d.name ?? '');
        if (d.branding) setBranding(d.branding);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/workspace/branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: workspaceName, branding }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success('Workspace settings saved');
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-[#f5f5f5] rounded-lg animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Workspace Branding</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">Customize your workspace identity and appearance.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Basic workspace identity settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Workspace Name</Label>
            <Input
              value={workspaceName}
              onChange={e => setWorkspaceName(e.target.value)}
              placeholder="My Company"
            />
          </div>
          <div className="space-y-1.5">
            <Label>App Name</Label>
            <Input
              value={branding.app_name}
              onChange={e => setBranding(b => ({ ...b, app_name: e.target.value }))}
              placeholder="VoiceOS"
            />
            <p className="text-xs text-[#6b6b6b]">Displayed in the sidebar and browser tab.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brand Colors</CardTitle>
          <CardDescription>Customize the primary accent color.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Primary Color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={branding.primary_color}
                onChange={e => setBranding(b => ({ ...b, primary_color: e.target.value }))}
                className="h-9 w-16 cursor-pointer rounded border border-[#e0e0e0]"
              />
              <Input
                value={branding.primary_color}
                onChange={e => setBranding(b => ({ ...b, primary_color: e.target.value }))}
                className="w-32 font-mono text-sm"
                placeholder="#0a0a0a"
              />
              <div
                className="h-9 w-24 rounded border border-[#e0e0e0]"
                style={{ backgroundColor: branding.primary_color }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo URL</CardTitle>
          <CardDescription>External URL of your company logo (PNG, SVG recommended).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={branding.logo_url ?? ''}
            onChange={e => setBranding(b => ({ ...b, logo_url: e.target.value || null }))}
            placeholder="https://yourdomain.com/logo.png"
          />
          {branding.logo_url && (
            <div className="rounded-lg border border-[#e0e0e0] p-4 bg-[#f5f5f5] flex items-center justify-center h-20">
              <img src={branding.logo_url} alt="Logo preview" className="max-h-16 object-contain" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saved ? (
            <><Check className="h-4 w-4 mr-1" /> Saved</>
          ) : saving ? (
            <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving…</>
          ) : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
