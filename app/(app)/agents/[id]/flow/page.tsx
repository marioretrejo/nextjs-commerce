'use client';

import { use, useCallback, useEffect, useState } from 'react';
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
  type Connection,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

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
  method: 'GET' | 'POST' | 'PUT';
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
// Custom node components (must be defined outside the page component)
// ---------------------------------------------------------------------------

function StartNode(_props: NodeProps) {
  return (
    <div
      data-testid="start_node"
      className="flex items-center justify-center px-5 py-2.5 rounded-full bg-gray-900 text-white font-semibold text-sm shadow-md select-none"
      style={{ minWidth: 90 }}
    >
      START
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

function AiStateNode({ data }: NodeProps) {
  const d = data as AiStateData;
  return (
    <div
      data-testid="ai_state"
      className="rounded-xl border-2 border-blue-300 bg-blue-50 px-4 py-3 shadow-sm"
      style={{ minWidth: 180, maxWidth: 240 }}
    >
      <Handle type="target" position={Position.Left} id="in" />
      <p className="text-[10px] font-medium uppercase tracking-wide text-blue-400 mb-1">
        AI State
      </p>
      <p className="text-sm font-semibold text-blue-900 leading-tight">
        {d.state_name || 'Unnamed State'}
      </p>
      {d.system_instructions && (
        <p className="text-xs text-blue-600 mt-1 leading-snug">
          {String(d.system_instructions).slice(0, 60)}
          {String(d.system_instructions).length > 60 ? '…' : ''}
        </p>
      )}
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

function SemanticRouterNode({ data }: NodeProps) {
  const d = data as SemanticRouterData;
  const intents: Intent[] = Array.isArray(d.intents) ? d.intents : [];
  return (
    <div
      data-testid="semantic_router"
      className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 shadow-sm"
      style={{ minWidth: 180, maxWidth: 260 }}
    >
      <Handle type="target" position={Position.Left} id="in" />
      <p className="text-[10px] font-medium uppercase tracking-wide text-amber-500 mb-1">
        Semantic Router
      </p>
      <p className="text-sm font-semibold text-amber-900 mb-2">🔀 Router</p>
      <div className="flex flex-wrap gap-1">
        {intents.map((intent) => (
          <span
            key={intent.id}
            className="inline-block rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-800"
          >
            {intent.label || 'Intent'}
          </span>
        ))}
        {intents.length === 0 && (
          <span className="text-xs text-amber-400 italic">No intents yet</span>
        )}
      </div>
      {/* One output handle per intent */}
      {intents.map((intent, i) => (
        <Handle
          key={intent.id}
          type="source"
          position={Position.Right}
          id={intent.id}
          style={{ top: `${20 + i * 28}px` }}
        />
      ))}
      {/* Fallback handle when no intents */}
      {intents.length === 0 && (
        <Handle type="source" position={Position.Right} id="default" />
      )}
    </div>
  );
}

function WebhookNode({ data }: NodeProps) {
  const d = data as WebhookData;
  return (
    <div
      data-testid="webhook_node"
      className="rounded-xl border-2 border-purple-300 bg-purple-50 px-4 py-3 shadow-sm"
      style={{ minWidth: 180, maxWidth: 240 }}
    >
      <Handle type="target" position={Position.Left} id="in" />
      <p className="text-[10px] font-medium uppercase tracking-wide text-purple-400 mb-1">
        Webhook
      </p>
      <p className="text-sm font-semibold text-purple-900">⚡ Webhook</p>
      {d.url && (
        <p className="text-xs text-purple-600 mt-1 font-mono break-all">
          {d.method} {String(d.url).slice(0, 40)}
          {String(d.url).length > 40 ? '…' : ''}
        </p>
      )}
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

function TransferNode({ data }: NodeProps) {
  const d = data as TransferData;
  return (
    <div
      data-testid="transfer_node"
      className="rounded-xl border-2 border-cyan-300 bg-cyan-50 px-4 py-3 shadow-sm"
      style={{ minWidth: 160, maxWidth: 220 }}
    >
      <Handle type="target" position={Position.Left} id="in" />
      <p className="text-[10px] font-medium uppercase tracking-wide text-cyan-500 mb-1">
        Transfer
      </p>
      <p className="text-sm font-semibold text-cyan-900">📲 Transfer</p>
      {d.transfer_number && (
        <p className="text-xs text-cyan-700 mt-1 font-mono">{d.transfer_number}</p>
      )}
    </div>
  );
}

function EndCallNode({ data }: NodeProps) {
  const d = data as EndCallData;
  return (
    <div
      data-testid="end_call_node"
      className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 shadow-sm"
      style={{ minWidth: 150, maxWidth: 220 }}
    >
      <Handle type="target" position={Position.Left} id="in" />
      <p className="text-[10px] font-medium uppercase tracking-wide text-red-400 mb-1">
        End Call
      </p>
      <p className="text-sm font-semibold text-red-900">📵 End Call</p>
      {d.farewell && (
        <p className="text-xs text-red-600 mt-1">
          {String(d.farewell).slice(0, 40)}
          {String(d.farewell).length > 40 ? '…' : ''}
        </p>
      )}
    </div>
  );
}

// nodeTypes MUST be defined outside the component to avoid React Flow remount issues
const nodeTypes = {
  start_node: StartNode,
  ai_state: AiStateNode,
  semantic_router: SemanticRouterNode,
  webhook_node: WebhookNode,
  transfer_node: TransferNode,
  end_call_node: EndCallNode,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_NODES: Node[] = [
  {
    id: 'start',
    type: 'start_node',
    position: { x: 250, y: 180 },
    data: { label: 'Start' } satisfies StartNodeData,
    deletable: false,
  },
];

const defaultEdgeOptions = {
  animated: true,
  style: { strokeWidth: 2, stroke: '#6366f1' },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function FlowBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(DEFAULT_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  // Load saved flow_config on mount
  useEffect(() => {
    fetch(`/api/agents/${id}/flow`)
      .then((r) => r.json())
      .then((d: { flow_config: FlowConfig | null }) => {
        if (d.flow_config?.nodes?.length) {
          setNodes(d.flow_config.nodes);
          setEdges(d.flow_config.edges ?? []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, ...defaultEdgeOptions }, eds)),
    [setEdges]
  );

  // Generic node data updater
  function updateNode(nodeId: string, partialData: Record<string, unknown>) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...partialData } } : n
      )
    );
  }

  function addNode(
    type: 'ai_state' | 'semantic_router' | 'webhook_node' | 'transfer_node' | 'end_call_node'
  ) {
    const id_new = `${type}-${Date.now()}`;
    const defaults: Record<typeof type, Record<string, unknown>> = {
      ai_state: {
        label: 'AI State',
        state_name: '',
        system_instructions: '',
      } satisfies AiStateData,
      semantic_router: {
        label: 'Router',
        description: '',
        intents: [],
      } satisfies SemanticRouterData,
      webhook_node: {
        label: 'Webhook',
        url: '',
        method: 'POST',
        extract_variables: '',
      } satisfies WebhookData,
      transfer_node: {
        label: 'Transfer',
        transfer_number: '',
      } satisfies TransferData,
      end_call_node: {
        label: 'End Call',
        farewell: '',
      } satisfies EndCallData,
    };
    const newNode: Node = {
      id: id_new,
      type,
      position: { x: 350 + Math.random() * 150, y: 100 + nodes.length * 90 },
      data: defaults[type],
    };
    setNodes((nds) => [...nds, newNode]);
  }

  function resetCanvas() {
    setNodes(DEFAULT_NODES);
    setEdges([]);
    setSelectedId(null);
  }

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/agents/${id}/flow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow_config: { version: 2, nodes, edges } satisfies FlowConfig,
        }),
      });
      toast.success('Flow saved');
    } catch {
      toast.error('Save failed');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ----------------------------------------------------------------- */}
      {/* Top bar                                                            */}
      {/* ----------------------------------------------------------------- */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <Link href={`/agents/${id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span className="text-sm font-semibold">AI State Machine</span>
        </div>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          Save Flow
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* --------------------------------------------------------------- */}
        {/* Left palette                                                      */}
        {/* --------------------------------------------------------------- */}
        <aside className="flex w-52 shrink-0 flex-col border-r border-gray-200 bg-white">
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Add Node
            </p>

            <PaletteButton
              label="AI State"
              description="LLM mindset phase"
              color="blue"
              onClick={() => addNode('ai_state')}
            />
            <PaletteButton
              label="Router"
              description="Multi-intent routing"
              color="amber"
              onClick={() => addNode('semantic_router')}
            />
            <PaletteButton
              label="Webhook"
              description="HTTP call & extract"
              color="purple"
              onClick={() => addNode('webhook_node')}
            />
            <PaletteButton
              label="Transfer"
              description="Transfer to human"
              color="cyan"
              onClick={() => addNode('transfer_node')}
            />
            <PaletteButton
              label="End Call"
              description="Terminate conversation"
              color="red"
              onClick={() => addNode('end_call_node')}
            />
          </div>

          {/* Reset button pinned to bottom */}
          <div className="shrink-0 border-t border-gray-100 p-3">
            <button
              onClick={resetCanvas}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset canvas
            </button>
          </div>
        </aside>

        {/* --------------------------------------------------------------- */}
        {/* Canvas                                                            */}
        {/* --------------------------------------------------------------- */}
        <div className="flex-1">
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
            fitView
          >
            <Background color="#e5e7eb" gap={16} />
            <Controls />
            <MiniMap zoomable pannable />
            <Panel position="bottom-center">
              <p className="rounded border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-400">
                Click a node to inspect · Drag handles to connect · Scroll to zoom
              </p>
            </Panel>
          </ReactFlow>
        </div>

        {/* --------------------------------------------------------------- */}
        {/* Right inspector panel                                             */}
        {/* --------------------------------------------------------------- */}
        {selectedNode && selectedNode.id !== 'start' && (
          <aside className="w-72 shrink-0 overflow-y-auto border-l border-gray-200 bg-white p-4">
            <InspectorPanel
              node={selectedNode}
              updateNode={updateNode}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Palette button helper
// ---------------------------------------------------------------------------

type PaletteColor = 'blue' | 'amber' | 'purple' | 'cyan' | 'red';

const paletteColorMap: Record<
  PaletteColor,
  { dot: string; label: string; hover: string }
> = {
  blue: {
    dot: 'bg-blue-400',
    label: 'text-blue-700',
    hover: 'hover:border-blue-400 hover:bg-blue-50',
  },
  amber: {
    dot: 'bg-amber-400',
    label: 'text-amber-700',
    hover: 'hover:border-amber-400 hover:bg-amber-50',
  },
  purple: {
    dot: 'bg-purple-400',
    label: 'text-purple-700',
    hover: 'hover:border-purple-400 hover:bg-purple-50',
  },
  cyan: {
    dot: 'bg-cyan-400',
    label: 'text-cyan-700',
    hover: 'hover:border-cyan-400 hover:bg-cyan-50',
  },
  red: {
    dot: 'bg-red-400',
    label: 'text-red-700',
    hover: 'hover:border-red-400 hover:bg-red-50',
  },
};

function PaletteButton({
  label,
  description,
  color,
  onClick,
}: {
  label: string;
  description: string;
  color: PaletteColor;
  onClick: () => void;
}) {
  const c = paletteColorMap[color];
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg border border-gray-200 p-2.5 text-left transition-colors ${c.hover}`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full shrink-0 ${c.dot}`} />
        <span className={`text-sm font-medium ${c.label}`}>{label}</span>
        <Plus className="ml-auto h-3.5 w-3.5 text-gray-300" />
      </div>
      <p className="mt-0.5 pl-4 text-[11px] text-gray-400">{description}</p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inspector panel
// ---------------------------------------------------------------------------

function InspectorPanel({
  node,
  updateNode,
}: {
  node: Node;
  updateNode: (id: string, partial: Record<string, unknown>) => void;
}) {
  const type = node.type as string;

  function patch(partial: Record<string, unknown>) {
    updateNode(node.id, partial);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          {type.replace(/_/g, ' ')}
        </p>
      </div>

      {type === 'ai_state' && (
        <AiStateInspector data={node.data as AiStateData} patch={patch} />
      )}
      {type === 'semantic_router' && (
        <SemanticRouterInspector
          data={node.data as SemanticRouterData}
          patch={patch}
        />
      )}
      {type === 'webhook_node' && (
        <WebhookInspector data={node.data as WebhookData} patch={patch} />
      )}
      {type === 'transfer_node' && (
        <TransferInspector data={node.data as TransferData} patch={patch} />
      )}
      {type === 'end_call_node' && (
        <EndCallInspector data={node.data as EndCallData} patch={patch} />
      )}
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
        <Label className="text-xs">State Name</Label>
        <Input
          value={data.state_name}
          onChange={(e) => patch({ state_name: e.target.value })}
          placeholder="e.g. Qualification"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">System Instructions</Label>
        <Textarea
          rows={5}
          value={data.system_instructions}
          onChange={(e) => patch({ system_instructions: e.target.value })}
          placeholder="Describe the LLM objective for this phase…"
          className="text-sm resize-none"
        />
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
        { id: crypto.randomUUID(), label: '', description: '' },
      ],
    });
  }

  function removeIntent(intentId: string) {
    patch({ intents: intents.filter((i) => i.id !== intentId) });
  }

  function updateIntent(intentId: string, field: keyof Intent, value: string) {
    patch({
      intents: intents.map((i) =>
        i.id === intentId ? { ...i, [field]: value } : i
      ),
    });
  }

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">Router Description</Label>
        <Input
          value={data.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="What does this router decide?"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Intents</Label>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs"
            onClick={addIntent}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>

        {intents.length === 0 && (
          <p className="text-[11px] text-gray-400 italic">
            No intents yet. Add one to create output handles.
          </p>
        )}

        {intents.map((intent, idx) => (
          <div
            key={intent.id}
            className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 space-y-1.5"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
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
              <Label className="text-[10px] text-gray-500">Label</Label>
              <Input
                value={intent.label}
                onChange={(e) => updateIntent(intent.id, 'label', e.target.value)}
                placeholder="e.g. Pricing question"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-500">Description</Label>
              <Input
                value={intent.description}
                onChange={(e) =>
                  updateIntent(intent.id, 'description', e.target.value)
                }
                placeholder="When the caller asks about pricing…"
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
        <Label className="text-xs">URL</Label>
        <Input
          value={data.url}
          onChange={(e) => patch({ url: e.target.value })}
          placeholder="https://api.example.com/endpoint"
          className="h-8 text-sm font-mono"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Method</Label>
        <Select
          value={data.method}
          onValueChange={(v) => patch({ method: v as 'GET' | 'POST' | 'PUT' })}
        >
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
        <Label className="text-xs">Extract Variables</Label>
        <Input
          value={data.extract_variables}
          onChange={(e) => patch({ extract_variables: e.target.value })}
          placeholder="price,availability,name"
          className="h-8 text-sm font-mono"
        />
        <p className="text-[10px] text-gray-400">Comma-separated variable names to extract from the response</p>
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
      <Label className="text-xs">Transfer Number</Label>
      <Input
        value={data.transfer_number}
        onChange={(e) => patch({ transfer_number: e.target.value })}
        placeholder="+1234567890"
        className="h-8 text-sm font-mono"
      />
      <p className="text-[10px] text-gray-400">
        The call will be transferred to this number
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
      <Label className="text-xs">Farewell Message (optional)</Label>
      <Textarea
        rows={3}
        value={data.farewell}
        onChange={(e) => patch({ farewell: e.target.value })}
        placeholder="Thank you for calling, have a great day!"
        className="text-sm resize-none"
      />
    </div>
  );
}
