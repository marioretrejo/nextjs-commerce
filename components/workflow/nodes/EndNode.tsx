'use client';
import type { NodeProps } from '@xyflow/react';
import { PhoneOff } from 'lucide-react';
import { NodeShell } from './shared';

export function EndNode({ data }: NodeProps) {
  const d = data as { label?: string };
  return (
    <NodeShell
      color="#ef4444"
      bgColor="#fef2f2"
      icon={<PhoneOff className="h-3.5 w-3.5" />}
      label={d.label ?? 'End Call'}
      topHandle
      bottomHandle={false}
    />
  );
}
