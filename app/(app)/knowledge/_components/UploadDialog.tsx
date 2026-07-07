"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Loader2, Zap, X } from "lucide-react";
import { toast } from "sonner";
import type { KnowledgeBase, UploadForm } from "./types";

export function UploadDialog({
  open,
  onOpenChange,
  kb,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kb: KnowledgeBase | null;
  onUploaded: (kbId: string, chunks: number) => void;
}) {
  const [uploadForm, setUploadForm] = useState<UploadForm>({
    source_name: "",
    content: "",
  });
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    chunks_created: number;
    has_rag: boolean;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setUploadForm({ source_name: "", content: "" });
      setUploadResult(null);
    }
  }, [open, kb]);

  async function handleFileRead(file: File) {
    const name = file.name.replace(/\.[^.]+$/, "");
    setUploadForm((f) => ({ ...f, source_name: f.source_name || name }));
    const text = await file.text();
    setUploadForm((f) => ({ ...f, content: text }));
    toast.success('File loaded — click "Embed & Save" to index it');
  }

  async function submitUpload() {
    if (!kb) return;
    if (!uploadForm.source_name.trim() || !uploadForm.content.trim()) {
      toast.error("Source name and content are required");
      return;
    }
    setUploading(true);
    setUploadResult(null);
    try {
      const res = await fetch("/api/knowledge/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kb_id: kb.id, ...uploadForm }),
      });
      const data = (await res.json()) as {
        chunks_created: number;
        has_rag: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setUploadResult({
        chunks_created: data.chunks_created,
        has_rag: data.has_rag,
      });
      onUploaded(kb.id, data.chunks_created);
      toast.success(`${data.chunks_created} chunks embedded`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Document to &ldquo;{kb?.name}&rdquo;</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>
              Source name <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="Product FAQ, Pricing Sheet, Return Policy…"
              value={uploadForm.source_name}
              onChange={(e) =>
                setUploadForm((f) => ({ ...f, source_name: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>
                Content <span className="text-red-500">*</span>
              </Label>
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
              onChange={(e) =>
                setUploadForm((f) => ({ ...f, content: e.target.value }))
              }
              className="font-mono text-xs"
            />
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileRead(f);
              }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-[#6b6b6b]">
            <span>
              {uploadForm.content.length > 0 &&
                `~${Math.ceil(uploadForm.content.length / 1000)} chunks estimated`}
            </span>
            {uploadResult && (
              <span
                className={`font-medium flex items-center gap-1 ${uploadResult.has_rag ? "text-green-600" : "text-amber-600"}`}
              >
                {uploadResult.has_rag ? (
                  <>
                    <Zap className="h-3 w-3" /> {uploadResult.chunks_created}{" "}
                    chunks embedded — RAG active
                  </>
                ) : (
                  <>
                    {uploadResult.chunks_created} chunks saved (OPENAI_API_KEY
                    not set — no embeddings)
                  </>
                )}
              </span>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="mr-1.5 h-3.5 w-3.5" /> Close
          </Button>
          <Button
            onClick={submitUpload}
            disabled={
              uploading ||
              !uploadForm.source_name.trim() ||
              !uploadForm.content.trim()
            }
            className="bg-[#0a0a0a] text-white hover:bg-[#262626]"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Embedding…
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" /> Embed &amp; Save
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
