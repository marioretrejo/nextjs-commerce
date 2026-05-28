'use client';
import type { NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { NodeShell } from './shared';

export function ConditionNode({ data }: NodeProps) {
  const d = data as { label?: string; condition?: string };
  return (
    <NodeShell
      color="#f59e0b"
      bgColor="#fffbeb"
      icon={<GitBranch className="h-3.5 w-3.5" />}
      label={d.label ?? 'Condition'}
      detail={d.condition}
      rightHandle
      rightHandle2
    />
  );
}
