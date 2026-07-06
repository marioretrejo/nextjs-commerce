"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { QACRule } from "./types";

export function RuleCard({
  rule,
  onToggle,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  rule: QACRule;
  onToggle: (id: string, active: boolean) => void;
  onEdit: (rule: QACRule) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const alertSevColor =
    rule.alert_severity === "critical"
      ? "bg-[#111] text-white border-transparent"
      : "bg-[#f0f0f0] text-[#555] border-[#e0e0e0]";

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${rule.is_active ? "border-[#e0e0e0] bg-white" : "border-[#efefef] bg-[#fafafa] opacity-60"}`}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle / reorder arrows */}
        <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
          <button
            onClick={() => onMoveUp(rule.id)}
            disabled={isFirst}
            className="text-[#d0d0d0] hover:text-[#555] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onMoveDown(rule.id)}
            disabled={isLast}
            className="text-[#d0d0d0] hover:text-[#555] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${alertSevColor}`}
            >
              {rule.alert_severity === "critical" ? (
                <AlertTriangle className="h-2.5 w-2.5" />
              ) : (
                <ShieldAlert className="h-2.5 w-2.5" />
              )}
              {rule.alert_severity === "critical" ? "Critical" : "Warning"}
            </span>
            <span className="font-semibold text-sm text-[#111]">
              {rule.name}
            </span>
            {rule.regulation && (
              <span className="text-[10px] font-mono bg-[#f0f0f0] px-1.5 py-0.5 rounded text-[#6b6b6b]">
                {rule.regulation}
              </span>
            )}
          </div>
          <p className="text-xs text-[#555] mt-1 line-clamp-2">
            {rule.description}
          </p>

          {/* Examples + counter */}
          {expanded && (
            <div className="mt-3 space-y-2">
              {rule.examples.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Ejemplos de violación
                  </p>
                  <ul className="space-y-0.5">
                    {rule.examples.map((ex, i) => (
                      <li
                        key={i}
                        className="text-xs text-[#111] bg-[#fafafa] rounded px-2 py-1 border border-[#e0e0e0]"
                      >
                        ✗ {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {rule.counter_examples.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    NO es violación si…
                  </p>
                  <ul className="space-y-0.5">
                    {rule.counter_examples.map((ex, i) => (
                      <li
                        key={i}
                        className="text-xs text-[#555] bg-[#f8f8f8] rounded px-2 py-1 border border-[#e0e0e0]"
                      >
                        ✓ {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {(rule.examples.length > 0 || rule.counter_examples.length > 0) && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-2 flex items-center gap-1 text-[10px] font-medium text-[#9b9b9b] hover:text-[#555] transition-colors"
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
              {expanded
                ? "Ocultar"
                : `Ver ejemplos (${rule.examples.length + rule.counter_examples.length})`}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={rule.is_active}
            onCheckedChange={(v) => onToggle(rule.id, v)}
          />
          <button
            onClick={() => onEdit(rule)}
            className="text-xs text-[#6b6b6b] hover:text-[#111] border border-[#e0e0e0] rounded-lg px-2 py-1 hover:border-[#111] transition-colors"
          >
            Editar
          </button>
          <button
            onClick={() => onDelete(rule.id)}
            className="text-[#d0d0d0] hover:text-[#111] transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RuleModal ────────────────────────────────────────────────────────────────
