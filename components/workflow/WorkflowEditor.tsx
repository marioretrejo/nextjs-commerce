'use client';

import { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Connection,
  type NodeTypes,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Sparkles, Loader2, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { GreetingNode }   from './nodes/GreetingNode';
import { MessageNode }    from './nodes/MessageNode';
import { ConditionNode }  from './nodes/ConditionNode';
import { ApiCallNode }    from './nodes/ApiCallNode';
import { TransferNode }   from './nodes/TransferNode';
import { EndNode }        from './nodes/EndNode';

const NODE_TYPES: NodeTypes = {
  greeting:  GreetingNode,
  message:   MessageNode,
  condition: ConditionNode,
  api_call:  ApiCallNode,
  transfer:  TransferNode,
  end:       EndNode,
};

const PALETTE = [
  { type: 'message',   label: 'Message',   color: '#3b82f6', bg: '#eff6ff',  icon: '💬' },
  { type: 'condition', label: 'Condition', color: '#f59e0b', bg: '#fffbeb',  icon: '🔀' },
  { type: 'api_call',  label: 'API Call',  color: '#8b5cf6', bg: '#f5f3ff',  icon: '⚡' },
  { type: 'transfer',  label: 'Transfer',  color: '#06b6d4', bg: '#ecfeff',  icon: '📲' },
  { type: 'end',       label: 'End Call',  color: '#ef4444', bg: '#fef2f2',  icon: '📵' },
] as const;

const SEED_NODES: Node[] = [
  {
    id: 'n1',
    type: 'greeting',
    position: { x: 280, y: 50 },
    data: { label: 'Greeting', text: 'Hello! How can I help you today?' },
  },
];
const SEED_EDGES: Edge[] = [];

interface WorkflowEditorProps {
  agentId:       string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onSave?:       (nodes: Node[], edges: Edge[]) => Promise<void>;
}

export function WorkflowEditor({ agentId, initialNodes, initialEdges, onSave }: WorkflowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes ?? SEED_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges ?? SEED_EDGES);
  const [aiPrompt,   setAiPrompt]   = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const idRef = useRef(200);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, animated: true, style: { strokeWidth: 2.5, stroke: '#6366f1' }, markerEnd: { type: 'arrow' as never } }, eds)),
    [setEdges],
  );

  const addNode = useCallback((type: string) => {
    const id = `u${++idRef.current}`;
    const labels: Record<string, string> = {
      message: 'Message', condition: 'Condition',
      api_call: 'API Call', transfer: 'Transfer', end: 'End',
    };
    setNodes((nds) => [
      ...nds,
      {
        id,
        type,
        position: { x: 80 + Math.random() * 400, y: 80 + Math.random() * 320 },
        data: { label: labels[type] ?? type },
      },
    ]);
  }, [setNodes]);

  const generateFromAI = useCallback(async () => {
    if (!aiPrompt.trim() || generating) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/workflow/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt: aiPrompt, agentId }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const { nodes: newNodes, edges: newEdges } = await res.json() as { nodes: Node[]; edges: Edge[] };
      setNodes(newNodes);
      setEdges(newEdges);
      setAiPrompt('');
      toast.success('Workflow generated!');
    } catch {
      toast.error('Generation failed — please try again.');
    } finally {
      setGenerating(false);
    }
  }, [aiPrompt, agentId, generating, setNodes, setEdges]);

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(nodes, edges);
      toast.success('Workflow saved');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }, [nodes, edges, onSave]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
      {/* AI prompt bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[#e5e5e5] bg-[#fafafa] px-3 py-2.5">
        <Sparkles className="h-4 w-4 shrink-0 text-[#8b5cf6]" />
        <input
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && generateFromAI()}
          placeholder="Describe your workflow in plain English and press Enter or Generate…"
          disabled={generating}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#a0a0a0] disabled:opacity-60"
        />
        <button
          onClick={generateFromAI}
          disabled={!aiPrompt.trim() || generating}
          className="flex items-center gap-1.5 rounded-lg bg-[#8b5cf6] px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Generate
        </button>
        {onSave && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-[#0a0a0a] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Palette */}
        <div className="flex w-44 shrink-0 flex-col gap-2 overflow-y-auto border-r border-[#e5e5e5] bg-[#f8f8f8] p-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#a0a0a0]">
            Add Node
          </p>
          {PALETTE.map((n) => (
            <button
              key={n.type}
              onClick={() => addNode(n.type)}
              className="group flex items-center gap-2.5 rounded-xl border-2 bg-white px-3 py-2.5 text-left transition-all hover:shadow-md active:scale-95"
              style={{ borderColor: n.color + '44' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = n.color; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = n.color + '44'; }}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm"
                style={{ background: n.bg, border: `1.5px solid ${n.color}44` }}
              >
                {n.icon}
              </span>
              <span className="text-xs font-semibold text-[#1a1a1a]">{n.label}</span>
            </button>
          ))}
          <div className="mt-auto border-t border-[#e5e5e5] pt-3">
            <button
              onClick={() => { setNodes(SEED_NODES); setEdges(SEED_EDGES); }}
              className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-[#ef4444] transition-colors hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3" />
              Reset Canvas
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={NODE_TYPES}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ animated: true, style: { strokeWidth: 2.5, stroke: '#6366f1' }, markerEnd: { type: 'arrow' as never } }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e5e5" />
            <Controls showInteractive={false} className="!border-[#e5e5e5] !shadow-sm" />
            <MiniMap
              nodeStrokeWidth={3}
              className="!border-[#e5e5e5] !shadow-sm"
              nodeColor={(n) => {
                const colors: Record<string, string> = {
                  greeting: '#10b981', message: '#3b82f6', condition: '#f59e0b',
                  api_call: '#8b5cf6', transfer: '#06b6d4', end: '#ef4444',
                };
                return colors[n.type ?? ''] ?? '#a1a1aa';
              }}
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
