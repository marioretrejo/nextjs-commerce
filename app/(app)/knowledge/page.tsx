'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  BookOpen,
  Plus,
  Trash2,
  Upload,
  Loader2,
  FileText,
  Zap,
  ChevronRight,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface KnowledgeBase {
  id:          string;
  name:        string;
  description: string | null;
  created_at:  string;
  chunk_count: number;
}

interface UploadForm {
  source_name: string;
  content:     string;
}

export default function KnowledgePage() {
  const [bases, setBases]               = useState<KnowledgeBase[]>([]);
  const [loading, setLoading]           = useState(true);
  const [createOpen, setCreateOpen]     = useState(false);
  const [uploadOpen, setUploadOpen]     = useState(false);
  const [activeKb, setActiveKb]         = useState<KnowledgeBase | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);

  // Create KB form
  const [newName, setNewName]           = useState('');
  const [newDesc, setNewDesc]           = useState('');
  const [creating, setCreating]         = useState(false);

  // Upload form
  const [uploadForm, setUploadForm]     = useState<UploadForm>({ source_name: '', content: '' });
  const [uploading, setUploading]       = useState(false);
  const [uploadResult, setUploadResult] = useState<{ chunks_created: number; has_rag: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadBases = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/knowledge/bases');
    if (res.ok) setBases(await res.json() as KnowledgeBase[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadBases(); }, [loadBases]);

  async function createKb() {
    if (!newName.trim()) { toast.error('Name required'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/knowledge/bases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      const kb = await res.json() as KnowledgeBase;
      setBases((prev) => [{ ...kb, chunk_count: 0 }, ...prev]);
      setNewName(''); setNewDesc('');
      setCreateOpen(false);
      toast.success('Knowledge base created');
    } catch (e) { toast.error(String(e)); }
    finally { setCreating(false); }
  }

  async function deleteKb(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch('/api/knowledge/bases', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Delete failed');
      setBases((prev) => prev.filter((k) => k.id !== id));
      toast.success('Deleted');
    } catch (e) { toast.error(String(e)); }
    finally { setDeletingId(null); }
  }

  function openUpload(kb: KnowledgeBase) {
    setActiveKb(kb);
    setUploadForm({ source_name: '', content: '' });
    setUploadResult(null);
    setUploadOpen(true);
  }

  async function handleFileRead(file: File) {
    const name = file.name.replace(/\.[^.]+$/, '');
    setUploadForm((f) => ({ ...f, source_name: f.source_name || name }));
    const text = await file.text();
    setUploadForm((f) => ({ ...f, content: text }));
    toast.success('File loaded — click "Embed & Save" to index it');
  }

  async function submitUpload() {
    if (!activeKb) return;
    if (!uploadForm.source_name.trim() || !uploadForm.content.trim()) {
      toast.error('Source name and content are required');
      return;
    }
    setUploading(true);
    setUploadResult(null);
    try {
      const res = await fetch('/api/knowledge/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kb_id: activeKb.id, ...uploadForm }),
      });
      const data = await res.json() as { chunks_created: number; has_rag: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setUploadResult({ chunks_created: data.chunks_created, has_rag: data.has_rag });
      setBases((prev) =>
        prev.map((k) =>
          k.id === activeKb.id
            ? { ...k, chunk_count: k.chunk_count + data.chunks_created }
            : k
        )
      );
      toast.success(`${data.chunks_created} chunks embedded`);
    } catch (e) { toast.error(String(e)); }
    finally { setUploading(false); }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Knowledge Bases
          </h1>
          <p className="text-sm text-[#6b6b6b] mt-1">
            Vector-indexed documents. Agents automatically retrieve relevant context before every reply.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-[#0a0a0a] text-white hover:bg-[#262626]">
          <Plus className="mr-2 h-4 w-4" /> New Knowledge Base
        </Button>
      </div>

      {/* RAG info banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 flex items-start gap-2">
        <Zap className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
        <span>
          <strong>How RAG works:</strong> When a call starts, the agent&apos;s system prompt is embedded
          and the top matching chunks are injected automatically — no code changes needed.
          Requires <code className="text-xs bg-blue-100 px-1 rounded">OPENAI_API_KEY</code> to be set.
        </span>
      </div>

      {/* KB list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#6b6b6b] py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : bases.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#e0e0e0] py-20 text-center">
          <BookOpen className="h-12 w-12 text-[#e0e0e0] mb-4" />
          <p className="font-semibold text-[#0a0a0a]">No knowledge bases yet</p>
          <p className="text-sm text-[#6b6b6b] mt-1 mb-6 max-w-xs">
            Create a knowledge base and upload product docs, FAQs, or any text your agents should know.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create first KB
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {bases.map((kb) => (
            <Card key={kb.id} className="border-[#e0e0e0]">
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-[#f5f5f5] flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-[#6b6b6b]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0a0a0a]">{kb.name}</p>
                    {kb.description && (
                      <p className="text-xs text-[#6b6b6b] mt-0.5 truncate">{kb.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge
                        variant={kb.chunk_count > 0 ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {kb.chunk_count > 0 ? `${kb.chunk_count} chunks` : 'Empty'}
                      </Badge>
                      {kb.chunk_count > 0 && (
                        <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                          <Zap className="h-3 w-3" /> RAG active
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openUpload(kb)}
                    className="gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" /> Add Document
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-[#6b6b6b] hover:text-red-600"
                    disabled={deletingId === kb.id}
                    onClick={() => deleteKb(kb.id)}
                  >
                    {deletingId === kb.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create KB dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Knowledge Base</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Product FAQ, Support Docs…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createKb(); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                placeholder="What this KB covers…"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createKb} disabled={creating || !newName.trim()} className="bg-[#0a0a0a] text-white">
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload document dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Document to &ldquo;{activeKb?.name}&rdquo;</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Source name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Product FAQ, Pricing Sheet, Return Policy…"
                value={uploadForm.source_name}
                onChange={(e) => setUploadForm((f) => ({ ...f, source_name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Content <span className="text-red-500">*</span></Label>
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-3 w-3" /> Import .txt / .md file
                </button>
              </div>
              <Textarea
                rows={10}
                placeholder="Paste your document content here. It will be split into chunks and embedded automatically…"
                value={uploadForm.content}
                onChange={(e) => setUploadForm((f) => ({ ...f, content: e.target.value }))}
                className="font-mono text-xs"
              />
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileRead(f); }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-[#6b6b6b]">
              <span>
                {uploadForm.content.length > 0 &&
                  `~${Math.ceil(uploadForm.content.length / 1000)} chunks estimated`}
              </span>
              {uploadResult && (
                <span className={`font-medium flex items-center gap-1 ${uploadResult.has_rag ? 'text-green-600' : 'text-amber-600'}`}>
                  {uploadResult.has_rag ? (
                    <><Zap className="h-3 w-3" /> {uploadResult.chunks_created} chunks embedded — RAG active</>
                  ) : (
                    <>{uploadResult.chunks_created} chunks saved (OPENAI_API_KEY not set — no embeddings)</>
                  )}
                </span>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUploadOpen(false)}>
              <X className="mr-1.5 h-3.5 w-3.5" /> Close
            </Button>
            <Button
              onClick={submitUpload}
              disabled={uploading || !uploadForm.source_name.trim() || !uploadForm.content.trim()}
              className="bg-[#0a0a0a] text-white hover:bg-[#262626]"
            >
              {uploading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Embedding…</>
              ) : (
                <><Zap className="mr-2 h-4 w-4" /> Embed &amp; Save</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
