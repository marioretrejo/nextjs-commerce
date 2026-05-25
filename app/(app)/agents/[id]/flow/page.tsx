'use client';

import { useCallback, useEffect, useState, use } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, Plus, Save } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type NodeType = 'start' | 'say' | 'ask' | 'branch' | 'transfer' | 'end';

interface FlowNodeData {
  label: string;
  message?: string;
  variable?: string;
  condition?: string;
  transferNumber?: string;
  nodeType: NodeType;
  voiceId?: string;
  voiceName?: string;
  [key: string]: unknown;
}

interface Voice {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
}

const NODE_COLORS: Record<NodeType, { bg: string; border: string; text: string }> = {
  start:    { bg: '#0a0a0a', border: '#0a0a0a', text: '#ffffff' },
  say:      { bg: '#ffffff', border: '#0a0a0a', text: '#0a0a0a' },
  ask:      { bg: '#f5f5f5', border: '#6b6b6b', text: '#0a0a0a' },
  branch:   { bg: '#ffffff', border: '#6b6b6b', text: '#0a0a0a' },
  transfer: { bg: '#f5f5f5', border: '#0a0a0a', text: '#0a0a0a' },
  end:      { bg: '#0a0a0a', border: '#0a0a0a', text: '#ffffff' },
};

function CustomNode({ data }: { data: FlowNodeData }) {
  const colors = NODE_COLORS[data.nodeType] ?? NODE_COLORS.say;
  return (
    <div
      style={{
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        color: colors.text,
        borderRadius: 8,
        padding: '10px 16px',
        minWidth: 160,
        fontSize: 13,
      }}
    >
      <div style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase', marginBottom: 2 }}>{data.nodeType}</div>
      <div style={{ fontWeight: 600 }}>{data.label}</div>
      {data.message && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 3 }}>{String(data.message).slice(0, 40)}…</div>}
      {data.voiceName && (
        <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
          🎙 {String(data.voiceName)}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

const NODE_PALETTE: { type: NodeType; label: string; description: string }[] = [
  { type: 'say',      label: 'Say Message',    description: 'Agent speaks a line' },
  { type: 'ask',      label: 'Ask Question',   description: 'Ask and capture answer' },
  { type: 'branch',   label: 'Branch',         description: 'Conditional routing' },
  { type: 'transfer', label: 'Transfer Call',  description: 'Transfer to a number' },
  { type: 'end',      label: 'End Call',       description: 'End the conversation' },
];

const DEFAULT_NODES: Node<FlowNodeData>[] = [
  {
    id: 'start',
    type: 'custom',
    position: { x: 200, y: 50 },
    data: { label: 'Start', nodeType: 'start' },
    deletable: false,
  },
];

export default function FlowBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(DEFAULT_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Node<FlowNodeData> | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/agents/${id}/flow`).then(r => r.json() as Promise<{ flow_json: { nodes: Node<FlowNodeData>[]; edges: Edge[] } | null }>),
      fetch('/api/voices').then(r => r.ok ? r.json() as Promise<{ voices: Voice[] }> : Promise.resolve({ voices: [] })),
    ]).then(([flowData, voiceData]) => {
      if (flowData.flow_json?.nodes?.length) {
        setNodes(flowData.flow_json.nodes);
        setEdges(flowData.flow_json.edges ?? []);
      }
      setVoices(voiceData.voices ?? []);
      setLoading(false);
    });
  }, [id, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges(eds => addEdge(connection, eds)),
    [setEdges]
  );

  function addNode(type: NodeType) {
    const newNode: Node<FlowNodeData> = {
      id: `${type}-${Date.now()}`,
      type: 'custom',
      position: { x: 200 + Math.random() * 200, y: 150 + nodes.length * 80 },
      data: { label: NODE_PALETTE.find(n => n.type === type)?.label ?? type, nodeType: type },
    };
    setNodes(nds => [...nds, newNode]);
  }

  function updateSelectedNode(field: string, value: string) {
    if (!selected) return;
    setNodes(nds =>
      nds.map(n =>
        n.id === selected.id
          ? { ...n, data: { ...n.data, [field]: value } }
          : n
      )
    );
    setSelected(s => s ? { ...s, data: { ...s.data, [field]: value } } : s);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${id}/flow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow_json: { nodes, edges } }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Flow saved');
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-[#e0e0e0] bg-white px-4 h-12 shrink-0">
        <div className="flex items-center gap-3">
          <Link href={`/agents/${id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <span className="text-sm font-semibold">Flow Builder</span>
        </div>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Save Flow
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left palette */}
        <div className="w-52 border-r border-[#e0e0e0] bg-white p-3 space-y-1 overflow-y-auto shrink-0">
          <p className="text-xs font-medium text-[#6b6b6b] uppercase tracking-wide mb-2">Add Node</p>
          {NODE_PALETTE.map(({ type, label, description }) => (
            <button
              key={type}
              onClick={() => addNode(type)}
              className="w-full text-left rounded-lg border border-[#e0e0e0] p-2.5 hover:border-[#0a0a0a] transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Plus className="h-3 w-3 text-[#6b6b6b] group-hover:text-[#0a0a0a]" />
                <span className="text-sm font-medium">{label}</span>
              </div>
              <p className="text-xs text-[#6b6b6b] mt-0.5 pl-5">{description}</p>
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelected(node as Node<FlowNodeData>)}
            onPaneClick={() => setSelected(null)}
            fitView
          >
            <Background color="#e0e0e0" />
            <Controls />
            <MiniMap />
            <Panel position="bottom-center">
              <p className="text-xs text-[#6b6b6b] bg-white border border-[#e0e0e0] rounded px-2 py-1">
                Click a node to edit · Drag to connect · Click canvas to deselect
              </p>
            </Panel>
          </ReactFlow>
        </div>

        {/* Right: node config panel */}
        {selected && (
          <div className="w-64 border-l border-[#e0e0e0] bg-white p-4 space-y-4 overflow-y-auto shrink-0">
            <div>
              <p className="text-xs font-medium text-[#6b6b6b] uppercase tracking-wide mb-2">
                {selected.data.nodeType} Node
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Label</Label>
                <Input
                  value={selected.data.label}
                  onChange={e => updateSelectedNode('label', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {(selected.data.nodeType === 'say' || selected.data.nodeType === 'ask') && (
              <div className="space-y-1.5">
                <Label className="text-xs">Message</Label>
                <Textarea
                  rows={4}
                  value={selected.data.message ?? ''}
                  onChange={e => updateSelectedNode('message', e.target.value)}
                  placeholder="What the agent says…"
                  className="text-sm"
                />
              </div>
            )}

            {selected.data.nodeType === 'ask' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Store answer in variable</Label>
                <Input
                  value={selected.data.variable ?? ''}
                  onChange={e => updateSelectedNode('variable', e.target.value)}
                  placeholder="customer_name"
                  className="h-8 text-sm font-mono"
                />
              </div>
            )}

            {selected.data.nodeType === 'branch' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Condition</Label>
                <Input
                  value={selected.data.condition ?? ''}
                  onChange={e => updateSelectedNode('condition', e.target.value)}
                  placeholder="customer_name != ''"
                  className="h-8 text-sm font-mono"
                />
              </div>
            )}

            {selected.data.nodeType === 'transfer' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Transfer Number</Label>
                <Input
                  value={selected.data.transferNumber ?? ''}
                  onChange={e => updateSelectedNode('transferNumber', e.target.value)}
                  placeholder="+1234567890"
                  className="h-8 text-sm font-mono"
                />
              </div>
            )}

            {(selected.data.nodeType === 'say' || selected.data.nodeType === 'ask') && voices.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Voice (override)</Label>
                <Select
                  value={selected.data.voiceId ?? '__default__'}
                  onValueChange={(v) => {
                    const voice = voices.find(x => x.voice_id === v);
                    updateSelectedNode('voiceId', v === '__default__' ? '' : v);
                    updateSelectedNode('voiceName', v === '__default__' ? '' : (voice?.name ?? ''));
                  }}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Default (agent voice)</SelectItem>
                    {voices.map(v => (
                      <SelectItem key={v.voice_id} value={v.voice_id}>
                        {v.name}
                        {v.labels?.['gender'] && <span className="text-[#6b6b6b] ml-1 text-xs">· {v.labels['gender']}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-[#6b6b6b]">This node will use a different voice than the agent default</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
