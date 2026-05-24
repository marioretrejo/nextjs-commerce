'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { User, NotificationType } from '@/lib/supabase/types';
import { User as UserIcon, Lock, Bell, AlertTriangle, Upload, Check, Key, Building2 } from 'lucide-react';
import Link from 'next/link';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
];

const NOTIFICATION_TYPES: { type: NotificationType; label: string; description: string }[] = [
  { type: 'minutes_80',         label: '80% minutes used',        description: 'Alert when usage reaches 80% of limit.' },
  { type: 'minutes_100',        label: '100% minutes used',        description: 'Alert when all minutes are consumed.' },
  { type: 'campaign_completed', label: 'Campaign completed',       description: 'Notify when a campaign finishes.' },
  { type: 'contact_converted',  label: 'Contact converted',        description: 'Notify on each conversion.' },
  { type: 'qa_alert',           label: 'QA score alert',           description: 'Alert when a call scores below threshold.' },
  { type: 'team_invite',        label: 'Team invitations',         description: 'Notify when someone joins the workspace.' },
  { type: 'payment_failed',     label: 'Payment failed',           description: 'Critical billing failure alerts.' },
];

interface ProfileForm {
  name: string;
  company: string;
  timezone: string;
  language: string;
}

interface PasswordForm {
  current: string;
  next: string;
  confirm: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile tab
  const [profileForm, setProfileForm] = useState<ProfileForm>({ name: '', company: '', timezone: 'UTC', language: 'en' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Password tab
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({ current: '', next: '', confirm: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  // Notifications tab
  const [enabledNotifications, setEnabledNotifications] = useState<NotificationType[]>([]);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  // Danger zone
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirm1, setDeleteConfirm1] = useState('');
  const [deleteConfirm2, setDeleteConfirm2] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/me');
      if (res.ok) {
        const d = await res.json() as { user: User };
        const u = d.user;
        setUser(u);
        setProfileForm({
          name: u.name ?? '',
          company: u.company ?? '',
          timezone: 'UTC',
          language: 'en',
        });
      }
      setLoading(false);
    })();
  }, []);

  async function saveProfile() {
    setProfileSaving(true);
    setProfileSaved(false);
    await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileForm),
    });
    setProfileSaved(true);
    setProfileSaving(false);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  async function uploadAvatar(file: File) {
    setAvatarUploading(true);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/me/avatar', { method: 'POST', body: form });
    if (res.ok) {
      const d = await res.json() as { avatar_url: string };
      setUser(u => u ? { ...u, avatar_url: d.avatar_url } : u);
    }
    setAvatarUploading(false);
  }

  async function savePassword() {
    setPasswordError('');
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (passwordForm.next.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    setPasswordSaving(true);
    const res = await fetch('/api/me/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: passwordForm.current, new_password: passwordForm.next }),
    });
    if (!res.ok) {
      const err = await res.json() as { error?: string };
      setPasswordError(err.error ?? 'Failed to update password.');
    } else {
      setPasswordSaved(true);
      setPasswordForm({ current: '', next: '', confirm: '' });
      setTimeout(() => setPasswordSaved(false), 2000);
    }
    setPasswordSaving(false);
  }

  async function saveNotifications() {
    setNotifSaving(true);
    await fetch('/api/me/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabledNotifications }),
    });
    setNotifSaved(true);
    setNotifSaving(false);
    setTimeout(() => setNotifSaved(false), 2000);
  }

  function toggleNotif(type: NotificationType) {
    setEnabledNotifications(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }

  async function deleteAccount() {
    if (deleteConfirm1 !== 'DELETE' || deleteConfirm2 !== (user?.email ?? '')) return;
    setDeleting(true);
    await fetch('/api/me', { method: 'DELETE' });
    window.location.href = '/login';
  }

  const canDelete =
    deleteConfirm1 === 'DELETE' && deleteConfirm2 === (user?.email ?? '');

  const initials = user?.name
    ? user.name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? 'U';

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-[#f5f5f5] rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Settings</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">Manage your account preferences and security.</p>
        <div className="flex gap-2 mt-2">
          <span className="inline-flex items-center rounded-md border border-[#0a0a0a] bg-[#0a0a0a] text-white px-3 py-1 text-xs font-medium">Account</span>
          <Link href="/settings/api-keys" className="inline-flex items-center gap-1 rounded-md border border-[#e0e0e0] px-3 py-1 text-xs font-medium text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors">
            <Key className="h-3 w-3" /> API Keys
          </Link>
          <Link href="/settings/workspace" className="inline-flex items-center gap-1 rounded-md border border-[#e0e0e0] px-3 py-1 text-xs font-medium text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors">
            <Building2 className="h-3 w-3" /> Workspace
          </Link>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile" className="flex items-center gap-1.5">
            <UserIcon className="w-3.5 h-3.5" /> Profile
          </TabsTrigger>
          <TabsTrigger value="password" className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Password
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="danger" className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Danger Zone
          </TabsTrigger>
        </TabsList>

        {/* Profile tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Update your personal information and preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16 bg-[#0a0a0a] text-white text-lg font-semibold flex items-center justify-center">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </Avatar>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={avatarUploading}
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    {avatarUploading ? 'Uploading…' : 'Upload Photo'}
                  </Button>
                  <p className="text-xs text-[#6b6b6b] mt-1">JPG, PNG, GIF up to 4 MB.</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pf-name">Full Name</Label>
                  <Input
                    id="pf-name"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pf-company">Company</Label>
                  <Input
                    id="pf-company"
                    value={profileForm.company}
                    onChange={(e) => setProfileForm(f => ({ ...f, company: e.target.value }))}
                    placeholder="Your company"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pf-tz">Timezone</Label>
                  <select
                    id="pf-tz"
                    value={profileForm.timezone}
                    onChange={(e) => setProfileForm(f => ({ ...f, timezone: e.target.value }))}
                    className="w-full h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
                  >
                    {TIMEZONES.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pf-lang">Language</Label>
                  <select
                    id="pf-lang"
                    value={profileForm.language}
                    onChange={(e) => setProfileForm(f => ({ ...f, language: e.target.value }))}
                    className="w-full h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
                  >
                    {LANGUAGES.map(l => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveProfile} disabled={profileSaving}>
                  {profileSaved ? (
                    <><Check className="w-4 h-4 mr-1" /> Saved</>
                  ) : profileSaving ? 'Saving…' : 'Save Profile'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Password tab */}
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password. Use a strong, unique password.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pw-current">Current Password</Label>
                <Input
                  id="pw-current"
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm(f => ({ ...f, current: e.target.value }))}
                  placeholder="Your current password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-new">New Password</Label>
                <Input
                  id="pw-new"
                  type="password"
                  value={passwordForm.next}
                  onChange={(e) => setPasswordForm(f => ({ ...f, next: e.target.value }))}
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-confirm">Confirm New Password</Label>
                <Input
                  id="pw-confirm"
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="Repeat new password"
                />
              </div>

              {passwordError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {passwordError}
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={savePassword}
                  disabled={passwordSaving || !passwordForm.current || !passwordForm.next}
                >
                  {passwordSaved ? (
                    <><Check className="w-4 h-4 mr-1" /> Updated</>
                  ) : passwordSaving ? 'Updating…' : 'Update Password'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose which events you want to be notified about.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {NOTIFICATION_TYPES.map((n) => (
                  <div key={n.type} className="flex items-start gap-3 py-1">
                    <Checkbox
                      id={`notif-${n.type}`}
                      checked={enabledNotifications.includes(n.type)}
                      onCheckedChange={() => toggleNotif(n.type)}
                      className="mt-0.5"
                    />
                    <div>
                      <Label
                        htmlFor={`notif-${n.type}`}
                        className="text-sm font-medium text-[#0a0a0a] cursor-pointer"
                      >
                        {n.label}
                      </Label>
                      <p className="text-xs text-[#6b6b6b] mt-0.5">{n.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="flex justify-end">
                <Button onClick={saveNotifications} disabled={notifSaving}>
                  {notifSaved ? (
                    <><Check className="w-4 h-4 mr-1" /> Saved</>
                  ) : notifSaving ? 'Saving…' : 'Save Preferences'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Danger zone */}
        <TabsContent value="danger">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>Irreversible and destructive actions.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-red-200 p-4">
                <p className="text-sm font-medium text-[#0a0a0a] mb-1">Delete Account</p>
                <p className="text-xs text-[#6b6b6b] mb-3">
                  Permanently delete your account, all workspaces, agents, campaigns, and calls. This cannot be undone.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete account dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all associated data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="del-confirm1">
                Type <span className="font-bold font-mono">DELETE</span> to confirm
              </Label>
              <Input
                id="del-confirm1"
                value={deleteConfirm1}
                onChange={(e) => setDeleteConfirm1(e.target.value)}
                placeholder="DELETE"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="del-confirm2">
                Type your email <span className="font-semibold">{user?.email ?? ''}</span> to confirm
              </Label>
              <Input
                id="del-confirm2"
                type="email"
                value={deleteConfirm2}
                onChange={(e) => setDeleteConfirm2(e.target.value)}
                placeholder={user?.email ?? ''}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-700 hover:bg-red-800 text-white border-transparent"
              disabled={!canDelete || deleting}
              onClick={deleteAccount}
            >
              {deleting ? 'Deleting…' : 'Delete My Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
