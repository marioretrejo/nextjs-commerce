'use client';

import { Handle, Position } from '@xyflow/react';
import type { ReactNode } from 'react';

interface NodeShellProps {
  color:       string;
  bgColor:     string;
  icon:        ReactNode;
  label:       string;
  detail?:     string;
  badge?:      string;
  topHandle?:    boolean;
  bottomHandle?: boolean;
  leftHandle?:   boolean;
  rightHandle?:  boolean;
  rightHandle2?: boolean;
}

const handleStyle = (color: string) => ({
  width: 12,
  height: 12,
  border: `2px solid ${color}`,
  background: '#fff',
  boxShadow: `0 0 0 2px ${color}22`,
});

export function NodeShell({
  color, bgColor, icon, label, detail, badge,
  topHandle = true, bottomHandle = true,
  leftHandle = false, rightHandle = false, rightHandle2 = false,
}: NodeShellProps) {
  return (
    <div
      className="min-w-[200px] max-w-[260px] rounded-2xl border-2 bg-white overflow-hidden"
      style={{
        borderColor: color,
        boxShadow: `0 4px 24px ${color}22, 0 1px 4px rgba(0,0,0,0.08)`,
      }}
    >
      {topHandle && (
        <Handle type="target" position={Position.Top} style={handleStyle(color)} />
      )}
      {leftHandle && (
        <Handle type="target" position={Position.Left} style={handleStyle(color)} />
      )}

      {/* Colored header strip */}
      <div
        className="flex items-center gap-2.5 px-4 py-3"
        style={{ background: bgColor }}
      >
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: color, color: '#fff' }}
        >
          {icon}
        </div>
        <span className="text-sm font-bold tracking-tight" style={{ color }}>
          {label}
        </span>
        {badge && (
          <span
            className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: color, color: '#fff' }}
          >
            {badge}
          </span>
        )}
      </div>

      {detail && (
        <p className="px-4 py-2.5 text-xs leading-relaxed text-[#555] border-t border-dashed" style={{ borderColor: color + '33' }}>
          {detail}
        </p>
      )}

      {bottomHandle && (
        <Handle type="source" position={Position.Bottom} style={handleStyle(color)} />
      )}
      {rightHandle && (
        <Handle type="source" position={Position.Right} id="yes" style={{ ...handleStyle(color), top: '40%' }} />
      )}
      {rightHandle2 && (
        <Handle type="source" position={Position.Right} id="no" style={{ ...handleStyle('#ef4444'), top: '65%' }} />
      )}
    </div>
  );
}
