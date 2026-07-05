"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Brain,
  GitBranch,
  Loader2,
  Maximize2,
  PhoneForwarded,
  PhoneOff,
  RotateCcw,
  Save,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DEFAULT_NODES,
  defaultEdgeOptions,
  TEMPLATES,
} from "./_components/flow-data";
import type {
  FlowConfig,
  Intent,
  SemanticRouterData,
} from "./_components/types";
import { nodeTypes } from "./_components/nodes";
import { PaletteButton } from "./_components/palette";
import { InspectorPanel } from "./_components/inspectors";

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
