"use client";

import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { Plus, Trash2, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { RagDoc } from "./constants";

export function RagSection({
  ragDocs,
  setRagDocs,
}: {
  ragDocs: RagDoc[];
  setRagDocs: Dispatch<SetStateAction<RagDoc[]>>;
}) {
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [showNewDocForm, setShowNewDocForm] = useState(false);

  function addDoc() {
    if (!newDocTitle.trim() || !newDocContent.trim()) {
      toast.error("Both title and content are required");
      return;
    }
    const doc: RagDoc = {
      id: String(Date.now()),
      title: newDocTitle.trim(),
      content: newDocContent.trim(),
    };
    setRagDocs((prev) => [...prev, doc]);
    setNewDocTitle("");
    setNewDocContent("");
    setShowNewDocForm(false);
    setExpandedDoc(doc.id);
  }

  function removeDoc(id: string) {
    setRagDocs((prev) => prev.filter((d) => d.id !== id));
    if (expandedDoc === id) setExpandedDoc(null);
  }

  function updateDoc(id: string, field: "title" | "content", value: string) {
    setRagDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
    );
  }

  return (
    <section className="bg-white border border-[#e5e5e5] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0a0a0a]">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0a0a0a]">
              Knowledge Base (RAG)
            </p>
            <p className="text-xs text-[#9b9b9b]">
              Documents injected as context. The AI will reference them in every
              response.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowNewDocForm((v) => !v)}
          className="text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add document
        </Button>
      </div>

      {/* New doc form */}
      {showNewDocForm && (
        <div className="p-6 border-b border-[#f0f0f0] bg-[#fafafa] space-y-3">
          <input
            value={newDocTitle}
            onChange={(e) => setNewDocTitle(e.target.value)}
            placeholder="Document title (e.g. «Product FAQ» or «Pricing Info»)"
            className="w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none focus:border-[#0a0a0a]"
          />
          <textarea
            value={newDocContent}
            onChange={(e) => setNewDocContent(e.target.value)}
            rows={6}
            placeholder="Paste document content here…"
            className="w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-mono leading-relaxed outline-none resize-y focus:border-[#0a0a0a]"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={addDoc} className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => {
                setShowNewDocForm(false);
                setNewDocTitle("");
                setNewDocContent("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {ragDocs.length === 0 && !showNewDocForm ? (
        <div className="flex flex-col items-center py-10 text-center">
          <FileText className="w-8 h-8 text-[#e0e0e0] mb-2" />
          <p className="text-sm text-[#6b6b6b]">No documents yet</p>
          <p className="text-xs text-[#9b9b9b] mt-0.5">
            Add FAQs, product info, pricing, or any context the AI should know.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#f5f5f5]">
          {ragDocs.map((doc) => (
            <div key={doc.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <button
                  className="flex items-center gap-2 text-sm font-medium text-[#0a0a0a] hover:text-[#404040] transition-colors text-left"
                  onClick={() =>
                    setExpandedDoc(expandedDoc === doc.id ? null : doc.id)
                  }
                >
                  {expandedDoc === doc.id ? (
                    <ChevronUp className="w-3.5 h-3.5 shrink-0 text-[#9b9b9b]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[#9b9b9b]" />
                  )}
                  {doc.title || "Untitled"}
                  <span className="text-xs text-[#9b9b9b] font-normal ml-1">
                    ({doc.content.length.toLocaleString()} chars)
                  </span>
                </button>
                <button
                  onClick={() => removeDoc(doc.id)}
                  className="rounded-md p-1.5 text-[#9b9b9b] transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {expandedDoc === doc.id && (
                <div className="mt-3 space-y-2">
                  <input
                    value={doc.title}
                    onChange={(e) => updateDoc(doc.id, "title", e.target.value)}
                    placeholder="Title"
                    className="w-full rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm outline-none focus:border-[#0a0a0a] focus:bg-white"
                  />
                  <textarea
                    value={doc.content}
                    onChange={(e) =>
                      updateDoc(doc.id, "content", e.target.value)
                    }
                    rows={8}
                    className="w-full rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm font-mono leading-relaxed outline-none resize-y focus:border-[#0a0a0a] focus:bg-white"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
