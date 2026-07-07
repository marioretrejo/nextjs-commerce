"use client";

import { useState, useEffect } from "react";
import { Save, Sparkles, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  type RagDoc,
  type CopilotConfig,
  DEFAULT_SYSTEM_PROMPT,
} from "./_components/constants";
import { SystemPromptSection } from "./_components/SystemPromptSection";
import { RagSection } from "./_components/RagSection";
import { ModelSettings } from "./_components/ModelSettings";

export default function CopilotConfigPage() {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [ragDocs, setRagDocs] = useState<RagDoc[]>([]);
  const [model, setModel] = useState("llama-3.3-70b-versatile");
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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

      <SystemPromptSection
        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
      />

      <RagSection ragDocs={ragDocs} setRagDocs={setRagDocs} />

      <ModelSettings
        model={model}
        setModel={setModel}
        temperature={temperature}
        setTemperature={setTemperature}
        maxTokens={maxTokens}
        setMaxTokens={setMaxTokens}
      />

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
