import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import type { SortKey, SortDir } from "./types";

export function SortTh({
  label,
  sortKey,
  currentKey,
  direction,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  direction: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      className={`px-4 py-2.5 text-left cursor-pointer select-none hover:bg-[#f8f8f8] transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`text-[10px] font-bold uppercase tracking-wider ${active ? "text-[#111]" : "text-[#9b9b9b]"}`}
        >
          {label}
        </span>
        {active ? (
          direction === "desc" ? (
            <ChevronDown className="h-3 w-3 text-[#555]" />
          ) : (
            <ChevronUp className="h-3 w-3 text-[#555]" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 text-[#d0d0d0]" />
        )}
      </div>
    </th>
  );
}
