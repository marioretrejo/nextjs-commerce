'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Key, Plus, Trash2, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchKeys() {
    const res = await fetch('/api/settings/api-keys');
    if (res.ok) setKeys((await res.json() as { keys: ApiKey[] }).keys);
    setLoading(false);
  }

  useEffect(() => { fetchKeys(); }, []);

  async function createKey() {
    if (!newKeyName.trim()) { toast.error('Name required'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      const d = await res.json() as { key: string };
      setGeneratedKey(d.key);
      setNewKeyName('');
      await fetchKeys();
    } catch (e) { toast.error(String(e)); }
    finally { setCreating(false); }
  }

  async function deleteKey(id: string) {
    setDeletingId(id);
    await fetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' });
    setKeys(k => k.filter(key => key.id !== id));
    toast.success('Key revoked');
    setDeletingId(null);
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">API Keys</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">Manage programmatic access to your VoiceOS workspace.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Access Keys</CardTitle>
            <CardDescription>Keys are used to authenticate API requests. Keep them secret.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Generate Key
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-12 bg-[#f5f5f5] rounded animate-pulse" />)}
            </div>
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Key className="h-8 w-8 text-[#e0e0e0] mb-2" />
              <p className="text-sm text-[#6b6b6b]">No API keys yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[#e0e0e0]">
              {keys.map(key => (
                <div key={key.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{key.name}</p>
                    <p className="text-xs text-[#6b6b6b] font-mono">{key.key_prefix}…</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#6b6b6b]">
                    <span>{key.last_used_at ? `Last used ${new Date(key.last_used_at).toLocaleDateString()}` : 'Never used'}</span>
                    <span>Created {new Date(key.created_at).toLocaleDateString()}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={deletingId === key.id}
                      onClick={() => deleteKey(key.id)}
                      className="text-[#6b6b6b] hover:text-red-500"
                    >
                      {deletingId === key.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create key dialog */}
      <Dialog open={createOpen} onOpenChange={open => { if (!open) { setCreateOpen(false); setGeneratedKey(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
            <DialogDescription>
              {generatedKey
                ? 'Copy your new API key now. You won\'t be able to see it again.'
                : 'Give this key a descriptive name so you can identify it later.'}
            </DialogDescription>
          </DialogHeader>

          {generatedKey ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-[#f5f5f5] border border-[#e0e0e0] p-3 flex items-center gap-2">
                <code className="flex-1 text-xs font-mono break-all text-[#0a0a0a]">{generatedKey}</code>
                <Button variant="ghost" size="icon" onClick={() => copyKey(generatedKey)}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-red-600">Store this key securely — it will not be shown again.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Key Name</Label>
              <Input
                placeholder="e.g. Production Server, Zapier Integration"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createKey(); }}
              />
            </div>
          )}

          <DialogFooter>
            {generatedKey ? (
              <Button onClick={() => { setCreateOpen(false); setGeneratedKey(null); }}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={createKey} disabled={creating || !newKeyName.trim()}>
                  {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                  Generate
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
