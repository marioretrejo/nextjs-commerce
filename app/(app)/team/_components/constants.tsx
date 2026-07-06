import { Badge } from "@/components/ui/badge";
import { Shield, Eye, Pencil } from "lucide-react";
import type {
  WorkspaceMember,
  MemberRole,
  MemberStatus,
} from "@/lib/supabase/types";

export const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  agents: "Agents",
  campaigns: "Campaigns",
  calls: "Calls & Recordings",
  analytics: "Analytics",
  knowledge: "Knowledge Base",
  quality: "QA Scoring",
  numbers: "Phone Numbers",
  compliance: "Compliance",
  integrations: "Integrations",
  team: "Team",
  billing: "Billing",
  settings: "Settings",
  developers: "Developers",
};

export const ROLES: {
  value: MemberRole;
  label: string;
  description: string;
}[] = [
  {
    value: "admin",
    label: "Admin",
    description: "Full access including billing and settings.",
  },
  {
    value: "editor",
    label: "Editor",
    description: "Can manage agents, campaigns, and calls.",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only access to all content.",
  },
];

export function roleBadge(role: MemberRole) {
  const map: Record<
    MemberRole,
    { label: string; icon: React.ReactNode; className: string }
  > = {
    admin: {
      label: "Admin",
      icon: <Shield className="w-3 h-3" />,
      className: "bg-[#0a0a0a] text-white border-transparent",
    },
    editor: {
      label: "Editor",
      icon: <Pencil className="w-3 h-3" />,
      className: "bg-[#f5f5f5] text-[#0a0a0a] border-[#e0e0e0]",
    },
    viewer: {
      label: "Viewer",
      icon: <Eye className="w-3 h-3" />,
      className: "border-[#e0e0e0] text-[#6b6b6b] bg-white",
    },
  };
  const s = map[role];
  return (
    <Badge className={`${s.className} flex items-center gap-1 text-xs`}>
      {s.icon}
      {s.label}
    </Badge>
  );
}

export function statusBadge(status: MemberStatus) {
  if (status === "active") {
    return (
      <Badge className="bg-[#f5f5f5] text-[#0a0a0a] border-[#e0e0e0] text-xs">
        Active
      </Badge>
    );
  }
  return (
    <Badge className="border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs">
      Pending
    </Badge>
  );
}

export function memberInitials(member: WorkspaceMember): string {
  const name = member.user?.name ?? member.invite_email ?? "U";
  return name.slice(0, 2).toUpperCase();
}

export interface WorkspaceIdResponse {
  workspace_id: string;
}
export interface TeamResponse {
  members: WorkspaceMember[];
}
export interface CurrentUserResponse {
  is_superadmin?: boolean;
  is_owner?: boolean;
  role?: string;
}
