import { Filter } from "lucide-react";
import { ALL_ACTIONS, ENTITY_TYPES, ACTION_LABELS } from "./config";

const selectCls =
  "rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function AuditFilters({
  filterAction,
  filterEntity,
  filterFrom,
  filterTo,
  onAction,
  onEntity,
  onFrom,
  onTo,
  onClear,
}: {
  filterAction: string;
  filterEntity: string;
  filterFrom: string;
  filterTo: string;
  onAction: (v: string) => void;
  onEntity: (v: string) => void;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="border-b border-gray-800 bg-gray-900/30 px-6 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-gray-500" />
        <select
          value={filterAction}
          onChange={(e) => onAction(e.target.value)}
          className={selectCls}
        >
          <option value="">All Actions</option>
          {ALL_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]}
            </option>
          ))}
        </select>
        <select
          value={filterEntity}
          onChange={(e) => onEntity(e.target.value)}
          className={selectCls}
        >
          <option value="">All Entities</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filterFrom}
          onChange={(e) => onFrom(e.target.value)}
          className={selectCls}
        />
        <span className="text-gray-600 text-sm">to</span>
        <input
          type="date"
          value={filterTo}
          onChange={(e) => onTo(e.target.value)}
          className={selectCls}
        />
        {(filterAction || filterEntity || filterFrom || filterTo) && (
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
