'use client';

import { useCallback } from 'react';
import { WorkflowEditor } from '@/components/workflow/WorkflowEditor';
import type { Node, Edge } from '@xyflow/react';
import { toast } from 'sonner';

interface Props {
  agentId:       string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
}

export function WorkflowClientWrapper({ agentId, initialNodes, initialEdges }: Props) {
  const handleSave = useCallback(async (nodes: Node[], edges: Edge[]) => {
    const res = await fetch(`/api/agents/${agentId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ workflow: { nodes, edges } }),
    });
    if (!res.ok) {
      toast.error('Failed to save workflow');
      throw new Error('save failed');
    }
  }, [agentId]);

  return (
    <WorkflowEditor
      agentId={agentId}
      initialNodes={initialNodes}
      initialEdges={initialEdges}
      onSave={handleSave}
    />
  );
}
