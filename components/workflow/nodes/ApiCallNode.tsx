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
      icon={<Zap className="h-3 w-3" />}
      label={d.label ?? 'API Call'}
      detail={detail}
    />
  );
}
