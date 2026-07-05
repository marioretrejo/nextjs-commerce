"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Brain, GitBranch, PhoneForwarded, PhoneOff, Zap } from "lucide-react";
import type {
  AiStateData,
  SemanticRouterData,
  WebhookData,
  TransferData,
  EndCallData,
  Intent,
} from "./types";

function StartNode(_props: NodeProps) {
  return (
    <div
      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white font-semibold text-sm shadow-lg select-none"
      style={{ minWidth: 100 }}
    >
      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
      START
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="!h-3 !w-3 !bg-gray-400 !border-2 !border-white"
      />
    </div>
  );
}

function AiStateNode({ data, selected }: NodeProps) {
  const d = data as AiStateData;
  return (
    <div
      className={`rounded-xl border-2 bg-white shadow-sm transition-shadow ${
        selected
          ? "border-blue-500 shadow-blue-100 shadow-md"
          : "border-blue-200"
      }`}
      style={{ minWidth: 200, maxWidth: 260 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!h-3 !w-3 !bg-blue-400 !border-2 !border-white"
      />
      <div className="flex items-center gap-2 rounded-t-xl bg-blue-50 px-3 py-2 border-b border-blue-100">
        <Brain className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-500">
          AI State
        </span>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-gray-900 leading-tight">
          {d.state_name || (
            <span className="text-gray-400 font-normal italic">
              Unnamed State
            </span>
          )}
        </p>
        {d.system_instructions && (
          <p className="text-[11px] text-gray-500 mt-1 leading-snug line-clamp-2">
            {String(d.system_instructions)}
          </p>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="!h-3 !w-3 !bg-blue-400 !border-2 !border-white"
      />
    </div>
  );
}

function SemanticRouterNode({ data, selected }: NodeProps) {
  const d = data as SemanticRouterData;
  const intents: Intent[] = Array.isArray(d.intents) ? d.intents : [];
  return (
    <div
      className={`rounded-xl border-2 bg-white shadow-sm transition-shadow ${
        selected
          ? "border-amber-500 shadow-amber-100 shadow-md"
          : "border-amber-200"
      }`}
      style={{ minWidth: 200, maxWidth: 280 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!h-3 !w-3 !bg-amber-400 !border-2 !border-white"
      />
      <div className="flex items-center gap-2 rounded-t-xl bg-amber-50 px-3 py-2 border-b border-amber-100">
        <GitBranch className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">
          Intent Router
        </span>
      </div>
      <div className="px-3 py-2.5 space-y-1">
        {d.description && (
          <p className="text-[11px] text-gray-500 mb-2">
            {String(d.description)}
          </p>
        )}
        {intents.length === 0 ? (
          <p className="text-xs text-amber-400 italic">
            Add intents in inspector →
          </p>
        ) : (
          intents.map((intent, i) => (
            <div key={intent.id} className="flex items-center gap-2">
              <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200 truncate max-w-[140px]">
                {intent.label || "Intent"}
              </span>
              {/* Right-side source handle per intent, evenly distributed */}
              <Handle
                type="source"
                position={Position.Right}
                id={intent.id}
                style={{ top: `${((i + 1) / (intents.length + 1)) * 100}%` }}
                className="!h-3 !w-3 !bg-amber-400 !border-2 !border-white"
              />
            </div>
          ))
        )}
        {intents.length === 0 && (
          <Handle
            type="source"
            position={Position.Right}
            id="default"
            className="!h-3 !w-3 !bg-amber-400 !border-2 !border-white"
          />
        )}
      </div>
    </div>
  );
}

function WebhookNode({ data, selected }: NodeProps) {
  const d = data as WebhookData;
  return (
    <div
      className={`rounded-xl border-2 bg-white shadow-sm transition-shadow ${
        selected
          ? "border-purple-500 shadow-purple-100 shadow-md"
          : "border-purple-200"
      }`}
      style={{ minWidth: 200, maxWidth: 260 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!h-3 !w-3 !bg-purple-400 !border-2 !border-white"
      />
      <div className="flex items-center gap-2 rounded-t-xl bg-purple-50 px-3 py-2 border-b border-purple-100">
        <Zap className="h-3.5 w-3.5 text-purple-500 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-500">
          Webhook
        </span>
        {d.method && (
          <span className="ml-auto rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-600">
            {d.method}
          </span>
        )}
      </div>
      <div className="px-3 py-2.5">
        {d.url ? (
          <p className="text-[11px] text-gray-600 font-mono truncate">
            {String(d.url)}
          </p>
        ) : (
          <p className="text-xs text-gray-400 italic">No URL set</p>
        )}
        {d.extract_variables && (
          <p className="text-[10px] text-purple-400 mt-1">
            extracts: {String(d.extract_variables)}
          </p>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="!h-3 !w-3 !bg-purple-400 !border-2 !border-white"
      />
    </div>
  );
}

function TransferNode({ data, selected }: NodeProps) {
  const d = data as TransferData;
  return (
    <div
      className={`rounded-xl border-2 bg-white shadow-sm transition-shadow ${
        selected
          ? "border-cyan-500 shadow-cyan-100 shadow-md"
          : "border-cyan-200"
      }`}
      style={{ minWidth: 180, maxWidth: 240 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!h-3 !w-3 !bg-cyan-400 !border-2 !border-white"
      />
      <div className="flex items-center gap-2 rounded-t-xl bg-cyan-50 px-3 py-2 border-b border-cyan-100">
        <PhoneForwarded className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-500">
          Transfer
        </span>
      </div>
      <div className="px-3 py-2.5">
        {d.transfer_number ? (
          <p className="text-sm font-mono text-gray-800">
            {String(d.transfer_number)}
          </p>
        ) : (
          <p className="text-xs text-gray-400 italic">No number set</p>
        )}
      </div>
    </div>
  );
}

function EndCallNode({ data, selected }: NodeProps) {
  const d = data as EndCallData;
  return (
    <div
      className={`rounded-xl border-2 bg-white shadow-sm transition-shadow ${
        selected ? "border-red-500 shadow-red-100 shadow-md" : "border-red-200"
      }`}
      style={{ minWidth: 160, maxWidth: 240 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!h-3 !w-3 !bg-red-400 !border-2 !border-white"
      />
      <div className="flex items-center gap-2 rounded-t-xl bg-red-50 px-3 py-2 border-b border-red-100">
        <PhoneOff className="h-3.5 w-3.5 text-red-500 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500">
          End Call
        </span>
      </div>
      <div className="px-3 py-2.5">
        {d.farewell ? (
          <p className="text-[11px] text-gray-600 line-clamp-2">
            {String(d.farewell)}
          </p>
        ) : (
          <p className="text-xs text-gray-400 italic">No farewell</p>
        )}
      </div>
    </div>
  );
}

export const nodeTypes = {
  start_node: StartNode,
  ai_state: AiStateNode,
  semantic_router: SemanticRouterNode,
  webhook_node: WebhookNode,
  transfer_node: TransferNode,
  end_call_node: EndCallNode,
};

// ---------------------------------------------------------------------------
// Constants & templates
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Inner canvas component (needs ReactFlowProvider context for fitView)
// ---------------------------------------------------------------------------
