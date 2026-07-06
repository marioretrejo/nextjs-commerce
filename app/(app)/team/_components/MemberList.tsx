import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Users, Plus, Trash2, Settings2 } from "lucide-react";
import { format } from "date-fns";
import type { WorkspaceMember } from "@/lib/supabase/types";
import { ROLE_WEIGHT } from "@/lib/team/permissions";
import { roleBadge, statusBadge, memberInitials } from "./constants";

export function MemberList({
  members,
  loading,
  currentUserWeight,
  isOwnerOrSuperadmin,
  removingId,
  onRemove,
  onOpenPermissions,
  onInvite,
}: {
  members: WorkspaceMember[];
  loading: boolean;
  currentUserWeight: number;
  isOwnerOrSuperadmin: boolean;
  removingId: string | null;
  onRemove: (id: string) => void;
  onOpenPermissions: (member: WorkspaceMember) => void;
  onInvite: () => void;
}) {
  return (
    <Card>
      {loading ? (
        <CardContent className="p-0">
          <div className="divide-y divide-[#e0e0e0]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="w-8 h-8 bg-[#f5f5f5] rounded-full animate-pulse" />
                <div className="w-40 h-4 bg-[#f5f5f5] rounded animate-pulse" />
                <div className="w-20 h-4 bg-[#f5f5f5] rounded animate-pulse ml-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      ) : members.length === 0 ? (
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Users className="w-12 h-12 text-[#e0e0e0] mb-4" />
          <p className="text-[#0a0a0a] font-medium mb-1">No team members yet</p>
          <p className="text-sm text-[#6b6b6b] mb-4">
            Invite colleagues to collaborate on this workspace.
          </p>
          <Button size="sm" onClick={onInvite}>
            <Plus className="w-4 h-4 mr-1" />
            Invite Member
          </Button>
        </CardContent>
      ) : (
        <CardContent className="p-0">
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3 border-b border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
            <span className="w-8" />
            <span>Member</span>
            <span>Role</span>
            <span>Status</span>
            <span>Joined</span>
            <span />
          </div>
          <div className="divide-y divide-[#e0e0e0]">
            {members.map((member) => {
              const canRemove =
                currentUserWeight > (ROLE_WEIGHT[member.role] ?? 0);
              return (
                <div
                  key={member.id}
                  className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-4 text-sm items-center hover:bg-[#f5f5f5]"
                >
                  <Avatar className="w-8 h-8 bg-[#0a0a0a] text-white text-xs flex items-center justify-center shrink-0">
                    <span>{memberInitials(member)}</span>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-[#0a0a0a] truncate">
                      {member.user?.name ?? member.invite_email ?? "—"}
                    </p>
                    <p className="text-xs text-[#6b6b6b] truncate">
                      {member.user?.email ?? member.invite_email ?? ""}
                    </p>
                  </div>
                  <span>{roleBadge(member.role)}</span>
                  <span>{statusBadge(member.status)}</span>
                  <span className="text-[#6b6b6b] text-xs">
                    {member.joined_at
                      ? format(new Date(member.joined_at), "MMM d, yyyy")
                      : member.status === "pending"
                        ? `Invited ${format(new Date(member.invited_at), "MMM d")}`
                        : "—"}
                  </span>
                  <span className="flex items-center gap-1 justify-end">
                    {isOwnerOrSuperadmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[#6b6b6b] hover:text-[#0a0a0a]"
                        onClick={() => onOpenPermissions(member)}
                        title="Manage role & permissions"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {canRemove && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[#6b6b6b] hover:text-[#0a0a0a]"
                        disabled={removingId === member.id}
                        onClick={() => onRemove(member.id)}
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
