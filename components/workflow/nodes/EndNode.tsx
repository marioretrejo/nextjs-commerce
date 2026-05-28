'use client';
import type { NodeProps } from '@xyflow/react';
import { PhoneOff } from 'lucide-react';
import { NodeShell } from './shared';

export function EndNode({ data }: NodeProps) {
  const d = data as { label?: string };
  return (
    <NodeShell
      color="#ef4444"
      icon={<PhoneOff className="h-3 w-3" />}
      label={d.label ?? 'End Call'}
      topHandle
      bottomHandle={false}
    />
  );
}
