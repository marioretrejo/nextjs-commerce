'use client';
import type { NodeProps } from '@xyflow/react';
import { Mic } from 'lucide-react';
import { NodeShell } from './shared';

export function GreetingNode({ data }: NodeProps) {
  const d = data as { label?: string; text?: string };
  return (
    <NodeShell
      color="#10b981"
      bgColor="#ecfdf5"
      icon={<Mic className="h-3.5 w-3.5" />}
      label={d.label ?? 'Greeting'}
      detail={d.text}
      badge="START"
      topHandle={false}
    />
  );
}
