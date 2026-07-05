"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, Maximize2, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FlowToolbar({
  id,
  nodeCount,
  edgeCount,
  saving,
  onFit,
  onSave,
  generatePrompt,
  setGeneratePrompt,
  generating,
  onGenerate,
}: {
  id: string;
  nodeCount: number;
  edgeCount: number;
  saving: boolean;
  onFit: () => void;
  onSave: () => void;
  generatePrompt: string;
  setGeneratePrompt: (v: string) => void;
  generating: boolean;
  onGenerate: () => void;
}) {
  return (
    <>
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href={`/agents/${id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="h-4 w-px bg-gray-200" />
          <span className="text-sm font-semibold text-gray-900">
            AI State Machine
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
            {nodeCount} node{nodeCount !== 1 ? "s" : ""} · {edgeCount} edge
            {edgeCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={onFit}
          >
            <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
            Fit
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving} className="h-8">
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            Save Flow
          </Button>
        </div>
      </header>
      {/* AI Generate bar */}
      <div className="shrink-0 border-b border-gray-200 bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50 px-4 py-2">
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
          <input
            type="text"
            value={generatePrompt}
            onChange={(e) => setGeneratePrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !generating) onGenerate();
            }}
            placeholder='Describe tu flujo… ej. "Calificación outbound: preguntar empresa, cargo y necesidad, si está calificado agendar demo, si no cerrar amigablemente"'
            className="flex-1 rounded-lg border border-violet-200 bg-white/80 px-3 py-1.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
            disabled={generating}
          />
          <Button
            size="sm"
            onClick={onGenerate}
            disabled={generating || !generatePrompt.trim()}
            className="h-8 bg-violet-600 hover:bg-violet-700 text-white shrink-0"
          >
            {generating ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Generando…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Generar
              </>
            )}
          </Button>
        </div>
      </div>{" "}
    </>
  );
}
