'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, FileText, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import Link from 'next/link';
import { use, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface Doc { id: string; name: string; type: string; status: string; page_count: number | null; created_at: string }

export default function KnowledgeBasePage({ params }: { params: Promise<{ agent_id: string }> }) {
  const { agent_id } = use(params);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: 'text' as string, content_text: '', url: '' });
  const [workspaceId, setWorkspaceId] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    async function load() {
      const [wsRes, docsRes] = await Promise.all([
        fetch('/api/admin/workspace-id'),
        fetch(`/api/knowledge?agent_id=${agent_id}`)
      ]);
      const wsData = await wsRes.json() as { workspace_id: string };
      setWorkspaceId(wsData.workspace_id ?? '');
      if (docsRes.ok) setDocs(await docsRes.json() as Doc[]);
      setLoading(false);
    }
    load();
  }, [agent_id]);

  async function addDoc() {
    if (!form.name) { toast.error('Name required'); return; }
    setAdding(true);
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id,
          workspace_id: workspaceId,
          name: form.name,
          type: form.type,
          content_text: form.type === 'text' ? form.content_text : null,
          file_url: form.type === 'url' ? form.url : null
        })
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      const doc = await res.json() as Doc;
      setDocs((d) => [doc, ...d]);
      setForm({ name: '', type: 'text', content_text: '', url: '' });
      toast.success('Document added');
    } catch (e) { toast.error(String(e)); }
    finally { setAdding(false); }
  }

  async function uploadPdf(file: File) {
    if (!form.name) { toast.error('Enter a document name first'); return; }
    setUploadingPdf(true);
    try {
      const supabase = createClient();
      const path = `${workspaceId}/${agent_id}/${Date.now()}-${file.name}`;
      const { error: upError } = await supabase.storage.from('knowledge').upload(path, file);
      if (upError) throw new Error(upError.message);
      const { data: urlData } = supabase.storage.from('knowledge').getPublicUrl(path);

      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id,
          workspace_id: workspaceId,
          name: form.name,
          type: 'pdf',
          file_url: urlData.publicUrl
        })
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      const doc = await res.json() as Doc;
      setDocs((d) => [doc, ...d]);
      setForm({ name: '', type: 'text', content_text: '', url: '' });
      toast.success('PDF uploaded — processing…');

      // Poll until status != 'processing'; ref ensures cleanup on unmount
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(async () => {
        const r = await fetch(`/api/knowledge?agent_id=${agent_id}`);
        if (r.ok) {
          const updated = await r.json() as Doc[];
          setDocs(updated);
          if (updated.every(d => d.status !== 'processing')) {
            clearInterval(pollIntervalRef.current!);
            pollIntervalRef.current = null;
          }
        }
      }, 5000);
    } catch (e) { toast.error(String(e)); }
    finally { setUploadingPdf(false); }
  }

  async function deleteDoc(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setDocs((d) => d.filter((doc) => doc.id !== id));
      toast.success('Document deleted');
    } catch (e) { toast.error(String(e)); }
    finally { setDeletingId(null); }
  }

  return (
    <div className="p-6 mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/agents/${agent_id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-sm text-[#6b6b6b]">{docs.length} documents</p>
        </div>
      </div>

      {/* Add document */}
      <Card>
        <CardHeader><CardTitle>Add Document</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="Product FAQ, Pricing Sheet…" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Plain Text</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="pdf">PDF Upload</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.type === 'text' && (
            <div className="space-y-1.5">
              <Label>Content</Label>
              <Textarea rows={6} placeholder="Paste your document content here…" value={form.content_text} onChange={(e) => setForm((f) => ({ ...f, content_text: e.target.value }))} />
            </div>
          )}
          {form.type === 'url' && (
            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input type="url" placeholder="https://your-website.com/page" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
            </div>
          )}
          {form.type === 'pdf' && (
            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#e0e0e0] p-8 text-center cursor-pointer hover:border-[#0a0a0a] transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {uploadingPdf ? (
                <Loader2 className="h-6 w-6 text-[#6b6b6b] mb-2 animate-spin" />
              ) : (
                <Upload className="h-6 w-6 text-[#6b6b6b] mb-2" />
              )}
              <p className="text-sm text-[#6b6b6b]">{uploadingPdf ? 'Uploading…' : 'Click to upload PDF (max 25 MB)'}</p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f); }}
              />
            </div>
          )}

          {form.type !== 'pdf' && (
            <Button onClick={addDoc} disabled={adding}>
              {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add Document
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Document list */}
      {loading ? (
        <p className="text-sm text-[#6b6b6b]">Loading…</p>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#e0e0e0] py-16 text-center">
          <FileText className="h-10 w-10 text-[#e0e0e0] mb-3" />
          <p className="font-medium">No documents yet</p>
          <p className="text-sm text-[#6b6b6b]">Add documents so your agent can answer questions from your content.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-[#6b6b6b]" />
                  <div>
                    <p className="font-medium text-sm">{doc.name}</p>
                    <p className="text-xs text-[#6b6b6b]">{doc.type} {doc.page_count ? `· ${doc.page_count} pages` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {doc.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin text-[#6b6b6b]" />}
                  <Badge variant={doc.status === 'ready' ? 'default' : 'secondary'}>{doc.status}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-[#6b6b6b]"
                    disabled={deletingId === doc.id}
                    onClick={() => deleteDoc(doc.id)}
                  >
                    {deletingId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
