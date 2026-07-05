"use client";

import type { ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function CrPill({ pct }: { pct: number }) {
  const color =
    pct >= 10
      ? "bg-green-100 text-green-700"
      : pct >= 5
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-600";
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${color}`}
    >
      {pct.toFixed(1)}%
    </span>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  icon: ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e0e0e0] to-transparent" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">
            {label}
          </p>
          <Icon className="h-3.5 w-3.5 text-[#d0d0d0]" />
        </div>
        <div
          className={`text-2xl font-bold mb-1 ${highlight ? "text-green-700" : "text-[#0a0a0a]"}`}
        >
          {value}
        </div>
        <p className="text-[10px] text-[#c0c0c0] font-medium">{sub}</p>
      </CardContent>
    </Card>
  );
}

export function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[#e8e8e8] bg-white px-2.5 py-1.5 text-xs text-[#333] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10 min-w-[140px]"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
