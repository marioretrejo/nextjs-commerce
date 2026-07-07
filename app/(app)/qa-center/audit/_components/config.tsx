import {
  Shield,
  User,
  FileText,
  Settings,
  UserCheck,
  MessageSquare,
} from "lucide-react";

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_id: string | null;
  created_at: string;
}

export interface AuditResponse {
  data: AuditLog[];
  total: number;
  page: number;
  pages: number;
}

export const ACTION_LABELS: Record<string, string> = {
  analyze: "Analysis Run",
  "interaction.create": "Interaction Created",
  "interaction.delete": "Interaction Deleted",
  "rule.create": "Rule Created",
  "rule.update": "Rule Updated",
  "rule.delete": "Rule Deleted",
  "agent.create": "Agent Created",
  "agent.update": "Agent Updated",
  "agent.deactivate": "Agent Deactivated",
  "agent.view": "Agent Viewed",
  "coaching_report.view": "Coaching Report Viewed",
  "coaching_report.generated": "Coaching Report Generated",
  "review_status.change": "Review Status Changed",
  "comment.create": "Comment Added",
};

export const ACTION_ICONS: Record<string, React.ReactNode> = {
  analyze: <FileText className="h-3.5 w-3.5" />,
  "interaction.create": <FileText className="h-3.5 w-3.5" />,
  "interaction.delete": <FileText className="h-3.5 w-3.5" />,
  "rule.create": <Settings className="h-3.5 w-3.5" />,
  "rule.update": <Settings className="h-3.5 w-3.5" />,
  "rule.delete": <Settings className="h-3.5 w-3.5" />,
  "agent.create": <UserCheck className="h-3.5 w-3.5" />,
  "agent.update": <UserCheck className="h-3.5 w-3.5" />,
  "agent.deactivate": <UserCheck className="h-3.5 w-3.5" />,
  "agent.view": <User className="h-3.5 w-3.5" />,
  "coaching_report.view": <FileText className="h-3.5 w-3.5" />,
  "coaching_report.generated": <FileText className="h-3.5 w-3.5" />,
  "review_status.change": <Shield className="h-3.5 w-3.5" />,
  "comment.create": <MessageSquare className="h-3.5 w-3.5" />,
};

export const ACTION_COLORS: Record<string, string> = {
  "interaction.delete": "text-red-400 bg-red-400/10",
  "agent.deactivate": "text-red-400 bg-red-400/10",
  "rule.delete": "text-red-400 bg-red-400/10",
  "rule.create": "text-emerald-400 bg-emerald-400/10",
  "agent.create": "text-emerald-400 bg-emerald-400/10",
  "interaction.create": "text-emerald-400 bg-emerald-400/10",
  "comment.create": "text-blue-400 bg-blue-400/10",
  "review_status.change": "text-amber-400 bg-amber-400/10",
};

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function formatDetails(log: AuditLog): string {
  if (!log.details) return "";
  if (log.action === "review_status.change") {
    const d = log.details as { from?: string; to?: string };
    return d.from && d.to ? `${d.from} → ${d.to}` : "";
  }
  if (log.action === "agent.create") {
    const d = log.details as { name?: string };
    return d.name ? `"${d.name}"` : "";
  }
  if (log.action === "agent.update") {
    const d = log.details as { fields?: string[] };
    return d.fields?.length ? `Fields: ${d.fields.join(", ")}` : "";
  }
  return "";
}

export const ALL_ACTIONS = Object.keys(ACTION_LABELS);
export const ENTITY_TYPES = [
  "interaction",
  "evaluation",
  "rule",
  "agent",
  "coaching_report",
  "review_comment",
];
