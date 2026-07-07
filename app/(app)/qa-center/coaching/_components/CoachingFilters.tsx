import { Filter } from "lucide-react";

const inputCls =
  "rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function CoachingFilters({
  filterPriority,
  filterFrom,
  filterTo,
  onPriority,
  onFrom,
  onTo,
  onClear,
}: {
  filterPriority: string;
  filterFrom: string;
  filterTo: string;
  onPriority: (v: string) => void;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="border-b border-gray-800 bg-gray-900/30 px-6 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-gray-500" />
        <select
          value={filterPriority}
          onChange={(e) => onPriority(e.target.value)}
          className={inputCls}
        >
          <option value="">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <input
          type="date"
          value={filterFrom}
          onChange={(e) => onFrom(e.target.value)}
          className={inputCls}
        />
        <span className="text-sm text-gray-600">to</span>
        <input
          type="date"
          value={filterTo}
          onChange={(e) => onTo(e.target.value)}
          className={inputCls}
        />
        {(filterPriority || filterFrom || filterTo) && (
          <button
            onClick={onClear}
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
