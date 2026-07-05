"use client";

import type { ReactNode } from "react";
import {
  Brain,
  Copy,
  GitBranch,
  PhoneForwarded,
  PhoneOff,
  Trash2,
  Zap,
} from "lucide-react";
import type { Node } from "@xyflow/react";
import type {
  AiStateData,
  SemanticRouterData,
  WebhookData,
  TransferData,
  EndCallData,
  Intent,
} from "./types";
import {
  AiStateInspector,
  SemanticRouterInspector,
  WebhookInspector,
  TransferInspector,
  EndCallInspector,
} from "./inspector-fields";

const typeLabels: Record<
  string,
  { label: string; color: string; icon: ReactNode }
> = {
  ai_state: {
    label: "AI State",
    color: "text-blue-600 bg-blue-50 border-blue-200",
    icon: <Brain className="h-3.5 w-3.5" />,
  },
  semantic_router: {
    label: "Intent Router",
    color: "text-amber-600 bg-amber-50 border-amber-200",
    icon: <GitBranch className="h-3.5 w-3.5" />,
  },
  webhook_node: {
    label: "Webhook",
    color: "text-purple-600 bg-purple-50 border-purple-200",
    icon: <Zap className="h-3.5 w-3.5" />,
  },
  transfer_node: {
    label: "Transfer",
    color: "text-cyan-600 bg-cyan-50 border-cyan-200",
    icon: <PhoneForwarded className="h-3.5 w-3.5" />,
  },
  end_call_node: {
    label: "End Call",
    color: "text-red-600 bg-red-50 border-red-200",
    icon: <PhoneOff className="h-3.5 w-3.5" />,
  },
};

export function InspectorPanel({
  node,
  updateNode,
  onDelete,
  onDuplicate,
}: {
  node: Node;
  updateNode: (id: string, partial: Record<string, unknown>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const type = node.type as string;
  const meta = typeLabels[type] ?? {
    label: type,
    color: "text-gray-600 bg-gray-50 border-gray-200",
    icon: null,
  };

  function patch(partial: Record<string, unknown>) {
    updateNode(node.id, partial);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Inspector header */}
      <div
        className={`flex items-center justify-between border-b px-4 py-3 ${meta.color}`}
      >
        <div className="flex items-center gap-2">
          {meta.icon}
          <span className="text-sm font-semibold">{meta.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onDuplicate}
            title="Duplicate node"
            className="rounded p-1 hover:bg-white/60 transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            title="Delete node"
            className="rounded p-1 hover:bg-red-100 hover:text-red-600 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Inspector body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {type === "ai_state" && (
          <AiStateInspector data={node.data as AiStateData} patch={patch} />
        )}
        {type === "semantic_router" && (
          <SemanticRouterInspector
            data={node.data as SemanticRouterData}
            patch={patch}
          />
        )}
        {type === "webhook_node" && (
          <WebhookInspector data={node.data as WebhookData} patch={patch} />
        )}
        {type === "transfer_node" && (
          <TransferInspector data={node.data as TransferData} patch={patch} />
        )}
        {type === "end_call_node" && (
          <EndCallInspector data={node.data as EndCallData} patch={patch} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-type inspector sub-components
// ---------------------------------------------------------------------------
