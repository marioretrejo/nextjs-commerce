"use client";

import {
  Brain,
  GitBranch,
  PhoneForwarded,
  PhoneOff,
  RotateCcw,
  Zap,
} from "lucide-react";
import { TEMPLATES } from "./flow-data";
import { PaletteButton } from "./palette";

export function PalettePanel({
  showTemplates,
  setShowTemplates,
  onLoadTemplate,
  onAddNode,
  onReset,
}: {
  showTemplates: boolean;
  setShowTemplates: (v: boolean) => void;
  onLoadTemplate: (key: string) => void;
  onAddNode: (
    type:
      | "ai_state"
      | "semantic_router"
      | "webhook_node"
      | "transfer_node"
      | "end_call_node",
  ) => void;
  onReset: () => void;
}) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {/* Templates button */}
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="mb-3 flex w-full items-center justify-between rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-left hover:bg-indigo-100 transition-colors"
        >
          <span className="text-xs font-semibold text-indigo-700">
            Quick Templates
          </span>
          <span className="text-[10px] text-indigo-400">
            {showTemplates ? "▲" : "▼"}
          </span>
        </button>

        {showTemplates && (
          <div className="mb-3 space-y-1">
            {Object.entries(TEMPLATES).map(([key, t]) => (
              <button
                key={key}
                onClick={() => onLoadTemplate(key)}
                className="w-full rounded-lg border border-gray-100 bg-gray-50 p-2 text-left hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
              >
                <p className="text-xs font-medium text-gray-800">{t.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {t.description}
                </p>
              </button>
            ))}
          </div>
        )}

        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          Add Node
        </p>

        <PaletteButton
          label="AI State"
          description="Objetivo + instrucciones LLM"
          color="blue"
          icon={<Brain className="h-3.5 w-3.5" />}
          onClick={() => onAddNode("ai_state")}
        />
        <PaletteButton
          label="Intent Router"
          description="Ramifica por intención"
          color="amber"
          icon={<GitBranch className="h-3.5 w-3.5" />}
          onClick={() => onAddNode("semantic_router")}
        />
        <PaletteButton
          label="Webhook"
          description="Llama una API HTTP"
          color="purple"
          icon={<Zap className="h-3.5 w-3.5" />}
          onClick={() => onAddNode("webhook_node")}
        />
        <PaletteButton
          label="Transfer"
          description="Transfiere a humano"
          color="cyan"
          icon={<PhoneForwarded className="h-3.5 w-3.5" />}
          onClick={() => onAddNode("transfer_node")}
        />
        <PaletteButton
          label="End Call"
          description="Termina la conversación"
          color="red"
          icon={<PhoneOff className="h-3.5 w-3.5" />}
          onClick={() => onAddNode("end_call_node")}
        />
      </div>

      <div className="shrink-0 border-t border-gray-100 p-3 space-y-1">
        <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">
          Tips
        </p>
        <p className="text-[10px] text-gray-400">
          • Click nodo → editar en panel derecho
        </p>
        <p className="text-[10px] text-gray-400">
          • Arrastra handle → conectar
        </p>
        <p className="text-[10px] text-gray-400">
          • Seleccionar + Delete → borrar
        </p>
        <button
          onClick={onReset}
          className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-50 hover:text-red-500 transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Reset canvas
        </button>
      </div>
    </aside>
  );
}
