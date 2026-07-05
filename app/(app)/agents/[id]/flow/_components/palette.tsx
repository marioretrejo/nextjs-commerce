"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";

export type PaletteColor = "blue" | "amber" | "purple" | "cyan" | "red";

export const paletteMap: Record<
  PaletteColor,
  { dot: string; label: string; hover: string; icon: string }
> = {
  blue: {
    dot: "bg-blue-400",
    label: "text-blue-700",
    hover: "hover:border-blue-300 hover:bg-blue-50",
    icon: "text-blue-500",
  },
  amber: {
    dot: "bg-amber-400",
    label: "text-amber-700",
    hover: "hover:border-amber-300 hover:bg-amber-50",
    icon: "text-amber-500",
  },
  purple: {
    dot: "bg-purple-400",
    label: "text-purple-700",
    hover: "hover:border-purple-300 hover:bg-purple-50",
    icon: "text-purple-500",
  },
  cyan: {
    dot: "bg-cyan-400",
    label: "text-cyan-700",
    hover: "hover:border-cyan-300 hover:bg-cyan-50",
    icon: "text-cyan-500",
  },
  red: {
    dot: "bg-red-400",
    label: "text-red-700",
    hover: "hover:border-red-300 hover:bg-red-50",
    icon: "text-red-500",
  },
};

export function PaletteButton({
  label,
  description,
  color,
  icon,
  onClick,
}: {
  label: string;
  description: string;
  color: PaletteColor;
  icon: ReactNode;
  onClick: () => void;
}) {
  const c = paletteMap[color];
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg border border-gray-200 p-2.5 text-left transition-all ${c.hover} group`}
    >
      <div className="flex items-center gap-2">
        <span className={`shrink-0 ${c.icon}`}>{icon}</span>
        <span className={`text-sm font-medium ${c.label}`}>{label}</span>
        <Plus className="ml-auto h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
      </div>
      <p className="mt-0.5 pl-6 text-[10px] text-gray-400">{description}</p>
    </button>
  );
}
