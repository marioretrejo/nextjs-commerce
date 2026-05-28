'use client';
import type { NodeProps } from '@xyflow/react';
import { PhoneForwarded } from 'lucide-react';
import { NodeShell } from './shared';

export function TransferNode({ data }: NodeProps) {
  const d = data as { label?: string; phoneNumber?: string };
  return (
    <NodeShell
      color="#06b6d4"
      icon={<PhoneForwarded className="h-3 w-3" />}
      label={d.label ?? 'Transfer'}
      detail={d.phoneNumber}
      bottomHandle={false}
    />
  );
}
