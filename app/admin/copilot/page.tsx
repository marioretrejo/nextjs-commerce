"use client";

import { useState, useEffect } from "react";
import {
  Bot,
  Save,
  Plus,
  Trash2,
  FileText,
  Sliders,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface RagDoc {
  id: string; // client-side only
  title: string;
  content: string;
}

interface CopilotConfig {
  system_prompt: string;
  rag_documents: { title: string; content: string }[];
  model: string;
  temperature: number;
  max_tokens: number;
  enabled: boolean;
}

const MODELS = [
  {
    value: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B Versatile (default)",
  },
  { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant (faster)" },
  { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
];

const DEFAULT_SYSTEM_PROMPT = `You are a friendly analytics copilot for VoiceOS, a voice-AI platform. You help workspace owners understand their data.

Rules:
- Be conversational and friendly. Answer greetings, general questions, and small talk naturally WITHOUT calling any tool.
- Only call a tool when the user specifically asks about metrics, calls, campaigns, agents, or analytics data.
- When you get tool results, summarize them in clear, concise natural language. Format numbers nicely (e.g. "2 calls", "85% success rate").
- If asked about projections, use current data to extrapolate (e.g. "at this pace, ~X by end of month").
- Respond in the same language the user writes in (Spanish or English).`;

export default function CopilotConfigPage() {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [ragDocs, setRagDocs] = useState<RagDoc[]>([]);
  const [model, setModel] = useState("llama-3.3-70b-versatile");
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [showNewDocForm, setShowNewDocForm] = useState(false);

  useEffect(() => {
    fetch("/api/admin/copilot-config")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("config"))))
      .then((d: { config?: CopilotConfig }) => {
        const c = d.config;
        if (!c) throw new Error("empty config");
        setSystemPrompt(c.system_prompt || DEFAULT_SYSTEM_PROMPT);
        setRagDocs(
          (c.rag_documents ?? []).map((doc, i) => ({ ...doc, id: String(i) })),
        );
        setModel(c.model ?? "llama-3.3-70b-versatile");
        setTemperature(c.temperature ?? 0.3);
        setMaxTokens(c.max_tokens ?? 1024);
        setEnabled(c.enabled ?? true);
      })
      .catch(() => {
        setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
        toast.error("Failed to load config");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/copilot-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          rag_documents: ragDocs.map(({ title, content }) => ({
            title,
            content,
          })),
          model,
          temperature,
          max_tokens: maxTokens,
          enabled,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Copilot config saved — changes are live immediately");
    } catch {
      toast.error("Failed to save config");
    } finally {
      setSaving(false);
    }
  }

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

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="h-6 w-48 bg-[#f0f0f0] rounded animate-pulse mb-2" />
        <div className="h-4 w-72 bg-[#f0f0f0] rounded animate-pulse" />
        <div className="mt-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 bg-[#f0f0f0] rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0a0a0a] flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Copilot Config
          </h1>
          <p className="text-sm text-[#6b6b6b] mt-0.5">
            Configure the Analytics Copilot AI — system prompt, knowledge base,
            and model settings. Changes apply to all workspaces immediately.
          </p>
        </div>

        {/* Enable toggle */}
        <button
          onClick={() => setEnabled((v) => !v)}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors border ${
            enabled
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {enabled ? (
            <ToggleRight className="w-4 h-4" />
          ) : (
            <ToggleLeft className="w-4 h-4" />
          )}
          Copilot {enabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      {/* ── Section 1: System Prompt ── */}
      <section className="bg-white border border-[#e5e5e5] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#f0f0f0]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0a0a0a]">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0a0a0a]">
              System Prompt
            </p>
            <p className="text-xs text-[#9b9b9b]">
              The AI's persona, rules, and base instructions. Injected at the
              start of every conversation.
            </p>
          </div>
        </div>
        <div className="p-6">
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={14}
            placeholder="Write the system prompt for the Analytics Copilot…"
            className="w-full rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-4 py-3 text-sm font-mono leading-relaxed text-[#1a1a1a] outline-none resize-y transition-colors focus:border-[#0a0a0a] focus:bg-white"
          />
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[#9b9b9b]">
            <Info className="w-3 h-3 shrink-0" />
            <span>
              The current date is injected automatically at runtime. RAG
              documents are appended below the system prompt.
            </span>
          </div>
          <button
            onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
            className="mt-3 text-xs text-[#9b9b9b] underline underline-offset-2 hover:text-[#0a0a0a] transition-colors"
          >
            Reset to default
          </button>
        </div>
      </section>

      {/* ── Section 2: RAG Knowledge Base ── */}
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
                Documents injected as context. The AI will reference them in
                every response.
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
              Add FAQs, product info, pricing, or any context the AI should
              know.
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
                      onChange={(e) =>
                        updateDoc(doc.id, "title", e.target.value)
                      }
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

      {/* ── Section 3: Model Settings ── */}
      <section className="bg-white border border-[#e5e5e5] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#f0f0f0]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0a0a0a]">
            <Sliders className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0a0a0a]">
              Model Settings
            </p>
            <p className="text-xs text-[#9b9b9b]">
              Controls which Groq model is used and how deterministic the
              responses are.
            </p>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {/* Model picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#404040]">Model</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {MODELS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setModel(m.value)}
                  className={`rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${
                    model === m.value
                      ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                      : "border-[#e5e5e5] text-[#404040] hover:border-[#0a0a0a]"
                  }`}
                >
                  <span className="font-medium block leading-tight">
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#404040]">
                Temperature
              </label>
              <span className="text-xs font-mono text-[#0a0a0a] bg-[#f5f5f5] px-2 py-0.5 rounded-md">
                {temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-[#0a0a0a]"
            />
            <div className="flex justify-between text-[10px] text-[#9b9b9b]">
              <span>0.0 — deterministic</span>
              <span>1.0 — creative</span>
            </div>
          </div>

          {/* Max tokens */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#404040]">
                Max Tokens
              </label>
              <span className="text-xs font-mono text-[#0a0a0a] bg-[#f5f5f5] px-2 py-0.5 rounded-md">
                {maxTokens.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={256}
              max={4096}
              step={256}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              className="w-full accent-[#0a0a0a]"
            />
            <div className="flex justify-between text-[10px] text-[#9b9b9b]">
              <span>256 — short replies</span>
              <span>4096 — detailed analysis</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Save bar ── */}
      <div className="fixed bottom-0 right-0 left-56 bg-white border-t border-[#e5e5e5] px-8 py-4 flex items-center justify-between z-40">
        <p className="text-xs text-[#9b9b9b]">
          Changes are applied to all workspaces immediately after saving.
        </p>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 text-sm"
        >
          {saving ? (
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Saving…" : "Save config"}
        </Button>
      </div>
    </div>
  );
}
