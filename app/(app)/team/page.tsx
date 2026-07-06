"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { WorkspaceMember } from "@/lib/supabase/types";
import { Users, Plus, Mail } from "lucide-react";
import { ROLE_WEIGHT } from "@/lib/team/permissions";
import type {
  WorkspaceIdResponse,
  TeamResponse,
  CurrentUserResponse,
} from "./_components/constants";
import { MemberList } from "./_components/MemberList";
import { InviteDialog } from "./_components/InviteDialog";
import { PermissionsDialog } from "./_components/PermissionsDialog";

export default function TeamPage() {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState("");
  const [currentUserWeight, setCurrentUserWeight] = useState<number>(0);
  const [isOwnerOrSuperadmin, setIsOwnerOrSuperadmin] = useState(false);

  // Permissions modal state
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [permissionsMember, setPermissionsMember] =
    useState<WorkspaceMember | null>(null);

  useEffect(() => {
    fetch("/api/admin/workspace-id")
      .then((r) => r.json())
      .then((d: WorkspaceIdResponse) => setWorkspaceId(d.workspace_id ?? ""))
      .catch(() => setLoading(false));
  }, []);

  // Fetch current user's weight once we have workspaceId
  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/team/current-user-role?workspace_id=${workspaceId}`)
      .then((r) =>
        r.ok ? (r.json() as Promise<CurrentUserResponse>) : Promise.resolve({}),
      )
      .then((d: CurrentUserResponse) => {
        if (d.is_superadmin) {
          setCurrentUserWeight(100);
          setIsOwnerOrSuperadmin(true);
          return;
        }
        if (d.is_owner) {
          setCurrentUserWeight(80);
          setIsOwnerOrSuperadmin(true);
          return;
        }
        const role = d.role ?? "";
        setCurrentUserWeight(ROLE_WEIGHT[role] ?? 0);
        setIsOwnerOrSuperadmin(false);
      })
      .catch(() => setCurrentUserWeight(0));
  }, [workspaceId]);

  const fetchMembers = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const res = await fetch(`/api/team?workspace_id=${workspaceId}`);
    if (res.ok) {
      const d = (await res.json()) as TeamResponse;
      setMembers(d.members ?? []);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) fetchMembers();
  }, [fetchMembers, workspaceId]);

  async function removeMember(id: string) {
    setRemovingId(id);
    await fetch(`/api/team/${id}`, { method: "DELETE" });
    await fetchMembers();
    setRemovingId(null);
  }

  function openPermissions(member: WorkspaceMember) {
    setPermissionsMember(member);
    setPermissionsOpen(true);
  }

  const stats = [
    {
      label: "Total Members",
      value: members.length,
      icon: <Users className="w-4 h-4 text-[#6b6b6b]" />,
    },
    {
      label: "Active",
      value: members.filter((m) => m.status === "active").length,
      icon: <Users className="w-4 h-4 text-[#6b6b6b]" />,
    },
    {
      label: "Pending",
      value: members.filter((m) => m.status === "pending").length,
      icon: <Mail className="w-4 h-4 text-[#6b6b6b]" />,
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">
            Team
          </h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            Manage workspace members and their permissions.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              {s.icon}
              <div>
                <p className="text-2xl font-bold text-[#0a0a0a]">{s.value}</p>
                <p className="text-xs text-[#6b6b6b]">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Members list */}
      <MemberList
        members={members}
        loading={loading}
        currentUserWeight={currentUserWeight}
        isOwnerOrSuperadmin={isOwnerOrSuperadmin}
        removingId={removingId}
        onRemove={removeMember}
        onOpenPermissions={openPermissions}
        onInvite={() => setInviteOpen(true)}
      />

      {/* Invite dialog */}
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        workspaceId={workspaceId}
        onInvited={fetchMembers}
      />

      {/* Permissions dialog */}
      <PermissionsDialog
        open={permissionsOpen}
        onOpenChange={(open) => {
          setPermissionsOpen(open);
          if (!open) setPermissionsMember(null);
        }}
        member={permissionsMember}
        onSaved={fetchMembers}
      />
    </div>
  );
}
