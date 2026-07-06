"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { MemberRole } from "@/lib/supabase/types";
import { ROLES } from "./constants";

export function InviteDialog({
  open,
  onOpenChange,
  workspaceId,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onInvited: () => void | Promise<void>;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("editor");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  async function inviteMember() {
    if (!inviteEmail.trim()) return;
    setInviteError("");
    setInviting(true);
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail.trim(),
        role: inviteRole,
        workspace_id: workspaceId,
      }),
    });
    if (res.ok) {
      await onInvited();
      onOpenChange(false);
      setInviteEmail("");
      setInviteRole("editor");
    } else {
      const err = (await res.json()) as { error?: string };
      setInviteError(err.error ?? "Failed to send invitation.");
    }
    setInviting(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation email to a colleague to join this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email Address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") inviteMember();
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as MemberRole)}
              className="w-full h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-[#6b6b6b]">
              {ROLES.find((r) => r.value === inviteRole)?.description}
            </p>
          </div>

          {inviteError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {inviteError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={inviteMember}
            disabled={inviting || !inviteEmail.trim()}
          >
            {inviting ? "Sending…" : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
