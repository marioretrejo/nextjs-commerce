'use client';
import type { NodeProps } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';
import { NodeShell } from './shared';

export function MessageNode({ data }: NodeProps) {
  const d = data as { label?: string; text?: string };
  return (
    <NodeShell
      color="#3b82f6"
      icon={<MessageSquare className="h-3 w-3" />}
      label={d.label ?? 'Message'}
      detail={d.text}
    />
  );
}
