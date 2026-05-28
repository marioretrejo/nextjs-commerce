'use client';
import type { NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import { NodeShell } from './shared';

export function ApiCallNode({ data }: NodeProps) {
  const d = data as { label?: string; url?: string; method?: string };
  const detail = d.url ? `${d.method ?? 'POST'} ${d.url}` : undefined;
  return (
    <NodeShell
      color="#8b5cf6"
      bgColor="#f5f3ff"
      icon={<Zap className="h-3.5 w-3.5" />}
      label={d.label ?? 'API Call'}
      detail={detail}
    />
  );
}
