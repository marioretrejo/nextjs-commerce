"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus, Zap } from "lucide-react";
import { toast } from "sonner";
import type { KnowledgeBase } from "./_components/types";
import { KbList } from "./_components/KbList";
import { CreateKbDialog } from "./_components/CreateKbDialog";
import { UploadDialog } from "./_components/UploadDialog";

export default function KnowledgePage() {
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeKb, setActiveKb] = useState<KnowledgeBase | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBases = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/knowledge/bases");
    if (res.ok) setBases((await res.json()) as KnowledgeBase[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBases();
  }, [loadBases]);

  async function deleteKb(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/knowledge/bases", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Delete failed");
      setBases((prev) => prev.filter((k) => k.id !== id));
      toast.success("Deleted");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDeletingId(null);
    }
  }

  function openUpload(kb: KnowledgeBase) {
    setActiveKb(kb);
    setUploadOpen(true);
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
            Vector-indexed documents. Agents automatically retrieve relevant
            context before every reply.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#0a0a0a] text-white hover:bg-[#262626]"
        >
          <Plus className="mr-2 h-4 w-4" /> New Knowledge Base
        </Button>
      </div>

      {/* RAG info banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 flex items-start gap-2">
        <Zap className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
        <span>
          <strong>How RAG works:</strong> When a call starts, the agent&apos;s
          system prompt is embedded and the top matching chunks are injected
          automatically — no code changes needed. Requires{" "}
          <code className="text-xs bg-blue-100 px-1 rounded">
            OPENAI_API_KEY
          </code>{" "}
          to be set.
        </span>
      </div>

      {/* KB list */}
      <KbList
        loading={loading}
        bases={bases}
        deletingId={deletingId}
        onCreate={() => setCreateOpen(true)}
        onUpload={openUpload}
        onDelete={(id) => void deleteKb(id)}
      />

      {/* Create KB dialog */}
      <CreateKbDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(kb) => setBases((prev) => [kb, ...prev])}
      />

      {/* Upload document dialog */}
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        kb={activeKb}
        onUploaded={(kbId, chunks) =>
          setBases((prev) =>
            prev.map((k) =>
              k.id === kbId ? { ...k, chunk_count: k.chunk_count + chunks } : k,
            ),
          )
        }
      />
    </div>
  );
}
