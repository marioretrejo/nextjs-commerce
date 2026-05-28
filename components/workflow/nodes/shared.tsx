'use client';

import { Handle, Position } from '@xyflow/react';
import type { ReactNode } from 'react';

interface NodeShellProps {
  color:   string;
  icon:    ReactNode;
  label:   string;
  detail?: string;
  topHandle?:    boolean;
  bottomHandle?: boolean;
  leftHandle?:   boolean;
  rightHandle?:  boolean;
}

export function NodeShell({
  color, icon, label, detail,
  topHandle = true, bottomHandle = true,
  leftHandle = false, rightHandle = false,
}: NodeShellProps) {
  return (
    <div
      className="min-w-[160px] max-w-[220px] rounded-xl border bg-white shadow-sm"
      style={{ borderColor: color }}
    >
      {topHandle    && <Handle type="target" position={Position.Top}    className="!border-2 !bg-white" style={{ borderColor: color }} />}
      {leftHandle   && <Handle type="target" position={Position.Left}   className="!border-2 !bg-white" style={{ borderColor: color }} />}

      <div className="flex items-center gap-2 rounded-t-xl px-3 py-2" style={{ background: color + '18' }}>
        <span style={{ color }}>{icon}</span>
        <span className="text-xs font-semibold" style={{ color }}>{label}</span>
      </div>
      {detail && (
        <p className="px-3 py-2 text-xs leading-snug text-[#404040]">{detail}</p>
      )}

      {bottomHandle && <Handle type="source" position={Position.Bottom} className="!border-2 !bg-white" style={{ borderColor: color }} />}
      {rightHandle  && <Handle type="source" position={Position.Right}  className="!border-2 !bg-white" style={{ borderColor: color }} />}
    </div>
  );
}
