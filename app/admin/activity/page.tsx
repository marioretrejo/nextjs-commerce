"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  Search,
  Bot,
  Megaphone,
  UserPlus,
  UserMinus,
  Settings,
  Link2,
  Shield,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface AuditLog {
  id: string;
  actor_id: string;
  actor_type: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  workspace_id: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  created_at: string;
  actor: { id: string; name: string | null; email: string } | null;
}

const ACTION_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  "agent.create": {
    label: "Agent created",
    icon: <Bot className="w-3.5 h-3.5" />,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  "agent.update": {
    label: "Agent updated",
    icon: <Bot className="w-3.5 h-3.5" />,
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  "agent.delete": {
    label: "Agent deleted",
    icon: <Bot className="w-3.5 h-3.5" />,
    color: "bg-red-50 text-red-700 border-red-200",
  },
  "campaign.launch": {
    label: "Campaign launched",
    icon: <Megaphone className="w-3.5 h-3.5" />,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  "campaign.pause": {
    label: "Campaign paused",
    icon: <Megaphone className="w-3.5 h-3.5" />,
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  "team.invite": {
    label: "Member invited",
    icon: <UserPlus className="w-3.5 h-3.5" />,
    color: "bg-violet-50 text-violet-700 border-violet-200",
  },
  "team.remove": {
    label: "Member removed",
    icon: <UserMinus className="w-3.5 h-3.5" />,
    color: "bg-red-50 text-red-700 border-red-200",
  },
  "team.role_change": {
    label: "Role changed",
    icon: <Shield className="w-3.5 h-3.5" />,
    color: "bg-violet-50 text-violet-700 border-violet-200",
  },
  "integration.connect": {
    label: "Integration added",
    icon: <Link2 className="w-3.5 h-3.5" />,
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  "workspace.suspend": {
    label: "Workspace suspended",
    icon: <Shield className="w-3.5 h-3.5" />,
    color: "bg-red-50 text-red-700 border-red-200",
  },
  "workspace.unsuspend": {
    label: "Workspace unsuspended",
    icon: <Shield className="w-3.5 h-3.5" />,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

const ACTION_FILTERS = [
  { label: "All", value: "" },
  { label: "Agents", value: "agent" },
  { label: "Campaigns", value: "campaign" },
  { label: "Team", value: "team" },
  { label: "Integrations", value: "integration" },
  { label: "Admin", value: "workspace" },
];

const PAGE_SIZE = 50;

export default function AdminActivityPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (actionFilter) params.set("action_prefix", actionFilter);
    if (search) params.set("search", search);

    const res = await fetch(`/api/admin/audit-logs?${params}`);
    if (res.ok) {
      const d = (await res.json()) as { logs: AuditLog[]; total: number };
      setLogs(d.logs ?? []);
      setTotal(d.total ?? 0);
    }
    setLoading(false);
  }, [page, actionFilter, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh every 10s when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(fetchLogs, 10_000);
    return () => clearInterval(t);
  }, [autoRefresh, fetchLogs]);

  function humanizeAction(log: AuditLog): string {
    const cfg = ACTION_CONFIG[log.action];
    if (cfg) {
      const m = log.metadata ?? {};
      if (log.action === "agent.create")
        return `Created agent "${m["agent_name"] ?? "—"}"`;
      if (log.action === "agent.update")
        return `Updated agent "${m["agent_name"] ?? log.target_id?.slice(0, 8) ?? "—"}"`;
      if (log.action === "agent.delete")
        return `Deleted agent "${m["agent_name"] ?? "—"}"`;
      if (log.action === "campaign.launch")
        return `Launched campaign "${m["campaign_name"] ?? "—"}" (${m["contacts"]} contacts)`;
      if (log.action === "campaign.pause")
        return `Paused campaign "${m["campaign_name"] ?? "—"}"`;
      if (log.action === "team.invite")
        return `Invited ${m["invited_email"]} as ${m["role"]}`;
      if (log.action === "team.remove") return `Removed a team member`;
      if (log.action === "team.role_change")
        return `Changed role to ${m["new_role"]}`;
      if (log.action === "integration.connect")
        return `Connected ${m["type"]} integration`;
      if (log.action === "workspace.suspend") return `Suspended workspace`;
      if (log.action === "workspace.unsuspend") return `Unsuspended workspace`;
    }
    return log.action.replace(".", " ");
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0a0a0a] flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Platform Activity
          </h1>
          <p className="text-sm text-[#6b6b6b] mt-0.5">
            All user actions across every workspace · {total.toLocaleString()}{" "}
            events total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh((v) => !v)}
            className="text-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${autoRefresh ? "animate-spin" : ""}`}
            />
            {autoRefresh ? "Live" : "Paused"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Action filter tabs */}
        <div className="flex gap-1 bg-[#f5f5f5] p-1 rounded-lg">
          {ACTION_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setActionFilter(f.value);
                setPage(0);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                actionFilter === f.value
                  ? "bg-white text-[#0a0a0a] shadow-sm"
                  : "text-[#6b6b6b] hover:text-[#0a0a0a]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9b9b9b]" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearch(searchInput);
                setPage(0);
              }
            }}
            placeholder="Search actor, workspace…"
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[140px_1fr_160px_120px_100px] gap-3 px-5 py-3 border-b border-[#e5e5e5] bg-[#fafafa]">
          {["Actor", "Action", "Workspace", "Time", "IP"].map((h) => (
            <span
              key={h}
              className="text-[10px] font-semibold uppercase tracking-widest text-[#9b9b9b]"
            >
              {h}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="divide-y divide-[#f5f5f5]">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[140px_1fr_160px_120px_100px] gap-3 px-5 py-3.5"
              >
                <div className="h-3 bg-[#f5f5f5] rounded animate-pulse w-24" />
                <div className="h-3 bg-[#f5f5f5] rounded animate-pulse w-48" />
                <div className="h-3 bg-[#f5f5f5] rounded animate-pulse w-32" />
                <div className="h-3 bg-[#f5f5f5] rounded animate-pulse w-20" />
                <div className="h-3 bg-[#f5f5f5] rounded animate-pulse w-16" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Activity className="w-10 h-10 text-[#e0e0e0] mb-3" />
            <p className="text-sm font-medium text-[#0a0a0a]">
              No activity yet
            </p>
            <p className="text-xs text-[#6b6b6b] mt-1">
              User actions will appear here as they happen.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#f5f5f5]">
            {logs.map((log) => {
              const cfg = ACTION_CONFIG[log.action];
              const actorDisplay =
                log.actor?.name ?? log.actor?.email ?? log.actor_id.slice(0, 8);
              return (
                <div
                  key={log.id}
                  className="grid grid-cols-[140px_1fr_160px_120px_100px] gap-3 px-5 py-3.5 hover:bg-[#fafafa] transition-colors items-start"
                >
                  {/* Actor */}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#0a0a0a] truncate">
                      {actorDisplay}
                    </p>
                    <p className="text-[10px] text-[#9b9b9b] truncate">
                      {log.actor_type === "superadmin"
                        ? "⚡ superadmin"
                        : (log.actor?.email ?? "")}
                    </p>
                  </div>

                  {/* Action */}
                  <div className="flex items-start gap-2 min-w-0">
                    {cfg && (
                      <Badge
                        className={`${cfg.color} shrink-0 text-[10px] px-1.5 py-0.5 border flex items-center gap-1`}
                      >
                        {cfg.icon}
                        {cfg.label}
                      </Badge>
                    )}
                    <span className="text-xs text-[#3a3a3a] leading-tight mt-0.5">
                      {humanizeAction(log)}
                    </span>
                  </div>

                  {/* Workspace */}
                  <div className="min-w-0">
                    <p className="text-xs text-[#6b6b6b] truncate font-mono">
                      {log.workspace_id?.slice(0, 16) ?? "—"}…
                    </p>
                  </div>

                  {/* Time */}
                  <div>
                    <p
                      className="text-xs text-[#6b6b6b]"
                      title={format(new Date(log.created_at), "PPpp")}
                    >
                      {formatDistanceToNow(new Date(log.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>

                  {/* IP */}
                  <div>
                    <p className="text-[10px] text-[#9b9b9b] font-mono">
                      {log.ip ?? "—"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#6b6b6b]">
            Page {page + 1} of {totalPages} · {total} events
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
