"use client";

import { AlertTriangle, CheckCircle2, Users, Zap } from "lucide-react";
import { ABUSE_THRESHOLD, type WorkspaceRow } from "./types";

export function StatsBar({
  workspaces,
  rejectionCounts,
}: {
  workspaces: WorkspaceRow[];
  rejectionCounts: Record<string, number>;
}) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {[
        {
          label: "Total",
          value: workspaces.length,
          icon: Users,
          color: "",
        },
        {
          label: "Active",
          value: workspaces.filter((w) => !w.is_suspended).length,
          icon: CheckCircle2,
          color: "",
        },
        {
          label: "Suspended",
          value: workspaces.filter((w) => w.is_suspended).length,
          icon: AlertTriangle,
          color: "text-red-500",
        },
        {
          label: "High Rejection Rate",
          value: Object.values(rejectionCounts).filter(
            (c) => c >= ABUSE_THRESHOLD,
          ).length,
          icon: Zap,
          color: "text-amber-500",
        },
      ].map(({ label, value, icon: Icon, color }) => (
        <div
          key={label}
          className="rounded-xl border border-[#e5e5e5] bg-white p-4"
        >
          <p className="text-xs text-[#a0a0a0] uppercase tracking-wider">
            {label}
          </p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-2xl font-bold text-[#1a1a1a]">{value}</span>
            <Icon className={`mb-0.5 h-4 w-4 ${color || "text-[#a0a0a0]"}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
