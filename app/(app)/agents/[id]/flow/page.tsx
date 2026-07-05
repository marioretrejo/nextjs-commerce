"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Brain,
  Copy,
  Maximize2,
  GitBranch,
  Loader2,
  PhoneForwarded,
  PhoneOff,
  Plus,
  Sparkles,
  RotateCcw,
  Save,
  Trash2,
  Webhook,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DEFAULT_NODES,
  defaultEdgeOptions,
  TEMPLATES,
} from "./_components/flow-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlowConfig {
  version: 2;
  nodes: Node[];
  edges: Edge[];
}

interface StartNodeData extends Record<string, unknown> {
  label: string;
}
interface AiStateData extends Record<string, unknown> {
  label: string;
  state_name: string;
  system_instructions: string;
}
interface Intent {
  id: string;
  label: string;
  description: string;
}
interface SemanticRouterData extends Record<string, unknown> {
  label: string;
  description: string;
  intents: Intent[];
}
interface WebhookData extends Record<string, unknown> {
  label: string;
  url: string;
  method: "GET" | "POST" | "PUT";
  extract_variables: string;
}
interface TransferData extends Record<string, unknown> {
  label: string;
  transfer_number: string;
}
interface EndCallData extends Record<string, unknown> {
  label: string;
  farewell: string;
}

// ---------------------------------------------------------------------------
// Node components  (defined outside page to prevent React Flow remount)
// ---------------------------------------------------------------------------

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

const nodeTypes = {
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

function FlowCanvas({ id }: { id: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(DEFAULT_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const { fitView } = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  // Load saved flow_config
  useEffect(() => {
    fetch(`/api/agents/${id}/flow`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { flow_config: FlowConfig | null }) => {
        if (d.flow_config?.nodes?.length) {
          setNodes(d.flow_config.nodes);
          setEdges(d.flow_config.edges ?? []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, setNodes, setEdges]);

  // Connect with intent edge labels
  const onConnect = useCallback(
    (connection: Connection) => {
      // Attach intent label to edge when connecting from a semantic_router
      const sourceNode = nodes.find((n) => n.id === connection.source);
      let label: string | undefined;
      if (sourceNode?.type === "semantic_router") {
        const d = sourceNode.data as SemanticRouterData;
        const intent = d.intents?.find((i) => i.id === connection.sourceHandle);
        if (intent?.label) label = intent.label;
      }
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            ...defaultEdgeOptions,
            ...(label ? { label } : {}),
          },
          eds,
        ),
      );
    },
    [nodes, setEdges],
  );

  // Keyboard delete for selected node
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (!selectedId || selectedId === "start") return;
      deleteNode(selectedId);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function deleteNode(nodeId: string) {
    if (nodeId === "start") return;
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== nodeId && e.target !== nodeId),
    );
    setSelectedId(null);
  }

  function deleteEdge(edgeId: string) {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
  }

  function updateNode(nodeId: string, partialData: Record<string, unknown>) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...partialData } } : n,
      ),
    );
    // Sync intent edge labels when Router intents change
    if (partialData.intents) {
      const intents = partialData.intents as Intent[];
      setEdges((eds) =>
        eds.map((e) => {
          if (e.source !== nodeId) return e;
          const intent = intents.find((i) => i.id === e.sourceHandle);
          if (!intent) return e;
          return { ...e, label: intent.label || e.label };
        }),
      );
    }
  }

  function duplicateNode(nodeId: string) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const newId = `${node.type}-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        ...node,
        id: newId,
        position: { x: node.position.x + 40, y: node.position.y + 40 },
        selected: false,
      },
    ]);
    toast.success("Node duplicated");
  }

  function addNode(
    type:
      | "ai_state"
      | "semantic_router"
      | "webhook_node"
      | "transfer_node"
      | "end_call_node",
  ) {
    const newId = `${type}-${Date.now()}`;
    const defaults: Record<string, Record<string, unknown>> = {
      ai_state: { label: "AI State", state_name: "", system_instructions: "" },
      semantic_router: { label: "Router", description: "", intents: [] },
      webhook_node: {
        label: "Webhook",
        url: "",
        method: "POST",
        extract_variables: "",
      },
      transfer_node: { label: "Transfer", transfer_number: "" },
      end_call_node: { label: "End Call", farewell: "" },
    };
    setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type,
        position: { x: 300 + Math.random() * 120, y: 80 + nds.length * 80 },
        data: defaults[type]!,
      },
    ]);
    setSelectedId(newId);
  }

  function loadTemplate(key: string) {
    const t = TEMPLATES[key];
    if (!t) return;
    setNodes(t.nodes);
    setEdges(t.edges);
    setSelectedId(null);
    setShowTemplates(false);
    setTimeout(() => fitView({ padding: 0.1, duration: 400 }), 50);
    toast.success(`Template "${t.label}" loaded`);
  }

  function resetCanvas() {
    setNodes(DEFAULT_NODES);
    setEdges([]);
    setSelectedId(null);
  }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch(`/api/agents/${id}/flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow_config: { version: 2, nodes, edges } satisfies FlowConfig,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success("Flow saved");
    } catch {
      toast.error("Failed to save flow");
    }
    setSaving(false);
  }

  async function generateFlow() {
    const desc = generatePrompt.trim();
    if (!desc) {
      toast.error("Describe el flujo que quieres generar");
      return;
    }
    setGenerating(true);
    try {
      const r = await fetch(`/api/agents/${id}/flow/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      const d = (await r.json()) as { flow: FlowConfig };
      setNodes(d.flow.nodes as Node[]);
      setEdges(d.flow.edges as Edge[]);
      setSelectedId(null);
      setTimeout(() => fitView({ padding: 0.15, duration: 600 }), 80);
      toast.success("¡Flujo generado! Revisa y ajusta los nodos.");
      setGeneratePrompt("");
    } catch (err) {
      toast.error(
        `Generación fallida — ${err instanceof Error ? err.message : "intenta de nuevo"}`,
      );
    }
    setGenerating(false);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const nonStartNodes = nodes.filter((n) => n.id !== "start");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
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
            {nonStartNodes.length} node{nonStartNodes.length !== 1 ? "s" : ""} ·{" "}
            {edges.length} edge{edges.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => {
              fitView({ padding: 0.1, duration: 400 });
            }}
          >
            <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
            Fit
          </Button>
          <Button size="sm" onClick={save} disabled={saving} className="h-8">
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
              if (e.key === "Enter" && !generating) generateFlow();
            }}
            placeholder='Describe tu flujo… ej. "Calificación outbound: preguntar empresa, cargo y necesidad, si está calificado agendar demo, si no cerrar amigablemente"'
            className="flex-1 rounded-lg border border-violet-200 bg-white/80 px-3 py-1.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
            disabled={generating}
          />
          <Button
            size="sm"
            onClick={generateFlow}
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
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left palette */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {/* Templates button */}
            <button
              onClick={() => setShowTemplates((v) => !v)}
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
                    onClick={() => loadTemplate(key)}
                    className="w-full rounded-lg border border-gray-100 bg-gray-50 p-2 text-left hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                  >
                    <p className="text-xs font-medium text-gray-800">
                      {t.label}
                    </p>
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
              onClick={() => addNode("ai_state")}
            />
            <PaletteButton
              label="Intent Router"
              description="Ramifica por intención"
              color="amber"
              icon={<GitBranch className="h-3.5 w-3.5" />}
              onClick={() => addNode("semantic_router")}
            />
            <PaletteButton
              label="Webhook"
              description="Llama una API HTTP"
              color="purple"
              icon={<Zap className="h-3.5 w-3.5" />}
              onClick={() => addNode("webhook_node")}
            />
            <PaletteButton
              label="Transfer"
              description="Transfiere a humano"
              color="cyan"
              icon={<PhoneForwarded className="h-3.5 w-3.5" />}
              onClick={() => addNode("transfer_node")}
            />
            <PaletteButton
              label="End Call"
              description="Termina la conversación"
              color="red"
              icon={<PhoneOff className="h-3.5 w-3.5" />}
              onClick={() => addNode("end_call_node")}
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
              onClick={resetCanvas}
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-50 hover:text-red-500 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset canvas
            </button>
          </div>
        </aside>

        {/* Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            onEdgeDoubleClick={(_, edge) => deleteEdge(edge.id)}
            deleteKeyCode={null}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.3}
            maxZoom={2}
          >
            <Background color="#d1d5db" gap={20} size={1} />
            <Controls />
            <MiniMap
              zoomable
              pannable
              nodeColor={(n) => {
                const colors: Record<string, string> = {
                  start_node: "#1f2937",
                  ai_state: "#3b82f6",
                  semantic_router: "#f59e0b",
                  webhook_node: "#8b5cf6",
                  transfer_node: "#06b6d4",
                  end_call_node: "#ef4444",
                };
                return colors[n.type ?? ""] ?? "#94a3b8";
              }}
            />
            <Panel position="bottom-center">
              <p className="rounded-full border border-gray-200 bg-white/90 backdrop-blur px-3 py-1 text-[10px] text-gray-400 shadow-sm">
                Doble click en edge para eliminarlo · Delete/Backspace para
                borrar nodo seleccionado
              </p>
            </Panel>
          </ReactFlow>
        </div>

        {/* Right inspector */}
        {selectedNode && selectedNode.id !== "start" && (
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-gray-200 bg-white">
            <InspectorPanel
              node={selectedNode}
              updateNode={updateNode}
              onDelete={() => deleteNode(selectedNode.id)}
              onDuplicate={() => duplicateNode(selectedNode.id)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page wrapper with ReactFlowProvider (required for useReactFlow hook)
// ---------------------------------------------------------------------------

export default function FlowBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <ReactFlowProvider>
      <FlowCanvas id={id} />
    </ReactFlowProvider>
  );
}

// ---------------------------------------------------------------------------
// Palette button
// ---------------------------------------------------------------------------

type PaletteColor = "blue" | "amber" | "purple" | "cyan" | "red";

const paletteMap: Record<
  PaletteColor,
  { dot: string; label: string; hover: string; icon: string }
> = {
  blue: {
    dot: "bg-blue-400",
    label: "text-blue-700",
    hover: "hover:border-blue-300 hover:bg-blue-50",
    icon: "text-blue-500",
  },
  amber: {
    dot: "bg-amber-400",
    label: "text-amber-700",
    hover: "hover:border-amber-300 hover:bg-amber-50",
    icon: "text-amber-500",
  },
  purple: {
    dot: "bg-purple-400",
    label: "text-purple-700",
    hover: "hover:border-purple-300 hover:bg-purple-50",
    icon: "text-purple-500",
  },
  cyan: {
    dot: "bg-cyan-400",
    label: "text-cyan-700",
    hover: "hover:border-cyan-300 hover:bg-cyan-50",
    icon: "text-cyan-500",
  },
  red: {
    dot: "bg-red-400",
    label: "text-red-700",
    hover: "hover:border-red-300 hover:bg-red-50",
    icon: "text-red-500",
  },
};

function PaletteButton({
  label,
  description,
  color,
  icon,
  onClick,
}: {
  label: string;
  description: string;
  color: PaletteColor;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const c = paletteMap[color];
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg border border-gray-200 p-2.5 text-left transition-all ${c.hover} group`}
    >
      <div className="flex items-center gap-2">
        <span className={`shrink-0 ${c.icon}`}>{icon}</span>
        <span className={`text-sm font-medium ${c.label}`}>{label}</span>
        <Plus className="ml-auto h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
      </div>
      <p className="mt-0.5 pl-6 text-[10px] text-gray-400">{description}</p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inspector panel
// ---------------------------------------------------------------------------

const typeLabels: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
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

function InspectorPanel({
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

function AiStateInspector({
  data,
  patch,
}: {
  data: AiStateData;
  patch: (p: Record<string, unknown>) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">State Name</Label>
        <Input
          value={data.state_name}
          onChange={(e) => patch({ state_name: e.target.value })}
          placeholder="e.g. Qualification, Closing…"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">System Instructions</Label>
        <Textarea
          rows={7}
          value={data.system_instructions}
          onChange={(e) => patch({ system_instructions: e.target.value })}
          placeholder="Describe the LLM objective and behaviour for this phase…"
          className="text-sm resize-none"
        />
      </div>
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Variables disponibles
        </p>
        <div className="flex flex-wrap gap-1">
          {[
            "{{contact_name}}",
            "{{contact_phone}}",
            "{{agent_name}}",
            "{{workspace_name}}",
          ].map((v) => (
            <code
              key={v}
              className="rounded bg-white border border-gray-200 px-1.5 py-0.5 text-[10px] text-indigo-600 cursor-pointer hover:bg-indigo-50"
              onClick={() =>
                patch({
                  system_instructions: (data.system_instructions || "") + v,
                })
              }
              title="Click to insert"
            >
              {v}
            </code>
          ))}
        </div>
        <p className="text-[9px] text-gray-400 mt-1.5">
          Click para insertar en las instrucciones
        </p>
      </div>
    </>
  );
}

function SemanticRouterInspector({
  data,
  patch,
}: {
  data: SemanticRouterData;
  patch: (p: Record<string, unknown>) => void;
}) {
  const intents: Intent[] = Array.isArray(data.intents) ? data.intents : [];

  function addIntent() {
    patch({
      intents: [
        ...intents,
        { id: crypto.randomUUID(), label: "", description: "" },
      ],
    });
  }
  function removeIntent(intentId: string) {
    patch({ intents: intents.filter((i) => i.id !== intentId) });
  }
  function updateIntent(intentId: string, field: keyof Intent, value: string) {
    patch({
      intents: intents.map((i) =>
        i.id === intentId ? { ...i, [field]: value } : i,
      ),
    });
  }

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Descripción del Router</Label>
        <Input
          value={data.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="¿Qué decide este router?"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">
            Intents ({intents.length})
          </Label>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs"
            onClick={addIntent}
          >
            <Plus className="mr-1 h-3 w-3" /> Añadir
          </Button>
        </div>

        {intents.length === 0 && (
          <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-3 text-center">
            <p className="text-[11px] text-amber-600">
              Sin intents. Cada intent crea un handle de salida en el nodo.
            </p>
          </div>
        )}

        {intents.map((intent, idx) => (
          <div
            key={intent.id}
            className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-amber-500 uppercase tracking-wide">
                Intent {idx + 1}
              </span>
              <button
                onClick={() => removeIntent(intent.id)}
                className="text-gray-300 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-500">
                Label (se muestra en el edge)
              </Label>
              <Input
                value={intent.label}
                onChange={(e) =>
                  updateIntent(intent.id, "label", e.target.value)
                }
                placeholder="e.g. Interesado"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-500">
                Descripción (para el LLM)
              </Label>
              <Input
                value={intent.description}
                onChange={(e) =>
                  updateIntent(intent.id, "description", e.target.value)
                }
                placeholder="Cuando el contacto expresa interés…"
                className="h-7 text-xs"
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function WebhookInspector({
  data,
  patch,
}: {
  data: WebhookData;
  patch: (p: Record<string, unknown>) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">URL</Label>
        <Input
          value={data.url}
          onChange={(e) => patch({ url: e.target.value })}
          placeholder="https://api.example.com/endpoint"
          className="h-8 text-sm font-mono"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Método HTTP</Label>
        <Select value={data.method} onValueChange={(v) => patch({ method: v })}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Variables a extraer</Label>
        <Input
          value={data.extract_variables}
          onChange={(e) => patch({ extract_variables: e.target.value })}
          placeholder="price,availability,lead_id"
          className="h-8 text-sm font-mono"
        />
        <p className="text-[10px] text-gray-400">
          Nombres separados por coma del JSON de respuesta
        </p>
      </div>
    </>
  );
}

function TransferInspector({
  data,
  patch,
}: {
  data: TransferData;
  patch: (p: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">Número de transferencia</Label>
      <Input
        value={data.transfer_number}
        onChange={(e) => patch({ transfer_number: e.target.value })}
        placeholder="+1234567890"
        className="h-8 text-sm font-mono"
      />
      <p className="text-[10px] text-gray-400">
        Formato E.164. La llamada se transfiere a este número via SIP REFER.
      </p>
    </div>
  );
}

function EndCallInspector({
  data,
  patch,
}: {
  data: EndCallData;
  patch: (p: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">Mensaje de despedida</Label>
      <Textarea
        rows={3}
        value={data.farewell}
        onChange={(e) => patch({ farewell: e.target.value })}
        placeholder="Gracias por su tiempo, ¡que tenga un buen día!"
        className="text-sm resize-none"
      />
      <p className="text-[10px] text-gray-400">
        Opcional. El agente lo dirá antes de colgar.
      </p>
    </div>
  );
}
