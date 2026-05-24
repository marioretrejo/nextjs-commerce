'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/avatar';
import type { WorkspaceMember, MemberRole, MemberStatus } from '@/lib/supabase/types';
import { Users, Plus, Trash2, Mail, Shield, Eye, Pencil } from 'lucide-react';
import { format } from 'date-fns';

const ROLES: { value: MemberRole; label: string; description: string }[] = [
  { value: 'admin',  label: 'Admin',  description: 'Full access including billing and settings.' },
  { value: 'editor', label: 'Editor', description: 'Can manage agents, campaigns, and calls.' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to all content.' },
];

function roleBadge(role: MemberRole) {
  const map: Record<MemberRole, { label: string; icon: React.ReactNode; className: string }> = {
    admin:  { label: 'Admin',  icon: <Shield className="w-3 h-3" />,  className: 'bg-[#0a0a0a] text-white border-transparent' },
    editor: { label: 'Editor', icon: <Pencil className="w-3 h-3" />, className: 'bg-[#f5f5f5] text-[#0a0a0a] border-[#e0e0e0]' },
    viewer: { label: 'Viewer', icon: <Eye className="w-3 h-3" />,    className: 'border-[#e0e0e0] text-[#6b6b6b] bg-white' },
  };
  const s = map[role];
  return (
    <Badge className={`${s.className} flex items-center gap-1 text-xs`}>
      {s.icon}
      {s.label}
    </Badge>
  );
}

function statusBadge(status: MemberStatus) {
  if (status === 'active') {
    return <Badge className="bg-[#f5f5f5] text-[#0a0a0a] border-[#e0e0e0] text-xs">Active</Badge>;
  }
  return <Badge className="border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs">Pending</Badge>;
}

function memberInitials(member: WorkspaceMember): string {
  const name = member.user?.name ?? member.invite_email ?? 'U';
  return name.slice(0, 2).toUpperCase();
}

export default function TeamPage() {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('editor');
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');

  useEffect(() => {
    fetch('/api/admin/workspace-id')
      .then((r) => r.json())
      .then((d: { workspace_id: string }) => setWorkspaceId(d.workspace_id ?? ''));
  }, []);

  const fetchMembers = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const res = await fetch(`/api/team?workspace_id=${workspaceId}`);
    if (res.ok) {
      const d = await res.json() as { members: WorkspaceMember[] };
      setMembers(d.members ?? []);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { if (workspaceId) fetchMembers(); }, [fetchMembers, workspaceId]);

  async function inviteMember() {
    if (!inviteEmail.trim()) return;
    setInviteError('');
    setInviting(true);
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, workspace_id: workspaceId }),
    });
    if (res.ok) {
      await fetchMembers();
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('editor');
    } else {
      const err = await res.json() as { error?: string };
      setInviteError(err.error ?? 'Failed to send invitation.');
    }
    setInviting(false);
  }

  async function removeMember(id: string) {
    setRemovingId(id);
    await fetch(`/api/team/${id}`, { method: 'DELETE' });
    await fetchMembers();
    setRemovingId(null);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Team</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">Manage workspace members and their permissions.</p>
        </div>
        <Button onClick={() => { setInviteOpen(true); setInviteError(''); }}>
          <Plus className="w-4 h-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Members', value: members.length, icon: <Users className="w-4 h-4 text-[#6b6b6b]" /> },
          { label: 'Active',        value: members.filter(m => m.status === 'active').length, icon: <Users className="w-4 h-4 text-[#6b6b6b]" /> },
          { label: 'Pending',       value: members.filter(m => m.status === 'pending').length, icon: <Mail className="w-4 h-4 text-[#6b6b6b]" /> },
        ].map((s) => (
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
            <p className="text-sm text-[#6b6b6b] mb-4">Invite colleagues to collaborate on this workspace.</p>
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Invite Member
            </Button>
          </CardContent>
        ) : (
          <CardContent className="p-0">
            <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_60px] gap-3 px-5 py-3 border-b border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
              <span className="w-8" />
              <span>Member</span>
              <span>Role</span>
              <span>Status</span>
              <span>Joined</span>
              <span />
            </div>
            <div className="divide-y divide-[#e0e0e0]">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_60px] gap-3 px-5 py-4 text-sm items-center hover:bg-[#f5f5f5]"
                >
                  <Avatar className="w-8 h-8 bg-[#0a0a0a] text-white text-xs flex items-center justify-center shrink-0">
                    <span>{memberInitials(member)}</span>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-[#0a0a0a] truncate">
                      {member.user?.name ?? member.invite_email ?? '—'}
                    </p>
                    <p className="text-xs text-[#6b6b6b] truncate">
                      {member.user?.email ?? member.invite_email ?? ''}
                    </p>
                  </div>
                  <span>{roleBadge(member.role)}</span>
                  <span>{statusBadge(member.status)}</span>
                  <span className="text-[#6b6b6b] text-xs">
                    {member.joined_at
                      ? format(new Date(member.joined_at), 'MMM d, yyyy')
                      : member.status === 'pending'
                        ? `Invited ${format(new Date(member.invited_at), 'MMM d')}`
                        : '—'}
                  </span>
                  <span className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-[#6b6b6b] hover:text-[#0a0a0a]"
                      disabled={removingId === member.id}
                      onClick={() => removeMember(member.id)}
                      title="Remove member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
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
                onKeyDown={(e) => { if (e.key === 'Enter') inviteMember(); }}
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
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <p className="text-xs text-[#6b6b6b]">
                {ROLES.find(r => r.value === inviteRole)?.description}
              </p>
            </div>

            {inviteError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {inviteError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              onClick={inviteMember}
              disabled={inviting || !inviteEmail.trim()}
            >
              {inviting ? 'Sending…' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
