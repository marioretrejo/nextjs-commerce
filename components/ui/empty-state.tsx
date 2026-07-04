import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  /** Icon shown above the title (defaults to an inbox). */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Optional CTA / action element rendered below the description. */
  action?: ReactNode;
  /** Compact variant for small cards (charts / sparklines). */
  compact?: boolean;
  className?: string;
}

/**
 * Reusable empty state. Use anywhere a chart, table, sparkline or list can
 * receive zero data — prevents "empty" charts from rendering as a solid bar.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "gap-1 py-4" : "gap-2 py-10"
      } ${className ?? ""}`}
    >
      <Icon
        className={`text-[#c8c8c8] ${compact ? "h-5 w-5" : "h-8 w-8"}`}
        aria-hidden="true"
      />
      <p
        className={`font-medium text-[#6b6b6b] ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        {title}
      </p>
      {description && !compact && (
        <p className="max-w-xs text-xs text-[#9b9b9b]">{description}</p>
      )}
      {action && <div className={compact ? "mt-1" : "mt-2"}>{action}</div>}
    </div>
  );
}
