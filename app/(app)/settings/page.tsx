"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { User, NotificationType } from "@/lib/supabase/types";
import {
  User as UserIcon,
  Lock,
  Bell,
  AlertTriangle,
  Key,
  Building2,
  Phone,
} from "lucide-react";
import Link from "next/link";
import type { ProfileForm, PasswordForm } from "./_components/constants";
import { ProfileTab } from "./_components/ProfileTab";
import { PasswordTab } from "./_components/PasswordTab";
import { NotificationsTab } from "./_components/NotificationsTab";
import { DangerTab } from "./_components/DangerTab";
import { DeleteAccountDialog } from "./_components/DeleteAccountDialog";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile tab
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    name: "",
    company: "",
    timezone: "UTC",
    language: "en",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Password tab
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  // Notifications tab
  const [enabledNotifications, setEnabledNotifications] = useState<
    NotificationType[]
  >([]);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  // Danger zone
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me");
      if (res.ok) {
        const d = (await res.json()) as { user: User };
        const u = d.user;
        setUser(u);
        setProfileForm({
          name: u.name ?? "",
          company: u.company ?? "",
          timezone: "UTC",
          language: "en",
        });
      }
      setLoading(false);
    })();
  }, []);

  async function saveProfile() {
    setProfileSaving(true);
    setProfileSaved(false);
    await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileForm),
    });
    setProfileSaved(true);
    setProfileSaving(false);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  async function uploadAvatar(file: File) {
    setAvatarUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/me/avatar", { method: "POST", body: form });
    if (res.ok) {
      const d = (await res.json()) as { avatar_url: string };
      setUser((u) => (u ? { ...u, avatar_url: d.avatar_url } : u));
    }
    setAvatarUploading(false);
  }

  async function savePassword() {
    setPasswordError("");
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (passwordForm.next.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    setPasswordSaving(true);
    const res = await fetch("/api/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: passwordForm.current,
        new_password: passwordForm.next,
      }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      setPasswordError(err.error ?? "Failed to update password.");
    } else {
      setPasswordSaved(true);
      setPasswordForm({ current: "", next: "", confirm: "" });
      setTimeout(() => setPasswordSaved(false), 2000);
    }
    setPasswordSaving(false);
  }

  async function saveNotifications() {
    setNotifSaving(true);
    await fetch("/api/me/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: enabledNotifications }),
    });
    setNotifSaved(true);
    setNotifSaving(false);
    setTimeout(() => setNotifSaved(false), 2000);
  }

  function toggleNotif(type: NotificationType) {
    setEnabledNotifications((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (user?.email?.slice(0, 2).toUpperCase() ?? "U");

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
        <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          Manage your account preferences and security.
        </p>
        <div className="flex gap-2 mt-2">
          <span className="inline-flex items-center rounded-md border border-[#0a0a0a] bg-[#0a0a0a] text-white px-3 py-1 text-xs font-medium">
            Account
          </span>
          <Link
            href="/settings/api-keys"
            className="inline-flex items-center gap-1 rounded-md border border-[#e0e0e0] px-3 py-1 text-xs font-medium text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
          >
            <Key className="h-3 w-3" /> API Keys
          </Link>
          <Link
            href="/settings/workspace"
            className="inline-flex items-center gap-1 rounded-md border border-[#e0e0e0] px-3 py-1 text-xs font-medium text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
          >
            <Building2 className="h-3 w-3" /> Workspace
          </Link>
          <Link
            href="/settings/sip-trunks"
            className="inline-flex items-center gap-1 rounded-md border border-[#e0e0e0] px-3 py-1 text-xs font-medium text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
          >
            <Phone className="h-3 w-3" /> SIP Trunks
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
          <TabsTrigger
            value="notifications"
            className="flex items-center gap-1.5"
          >
            <Bell className="w-3.5 h-3.5" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="danger" className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Danger Zone
          </TabsTrigger>
        </TabsList>

        <ProfileTab
          user={user}
          initials={initials}
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          profileSaving={profileSaving}
          profileSaved={profileSaved}
          avatarUploading={avatarUploading}
          onSave={saveProfile}
          onUploadAvatar={uploadAvatar}
        />

        <PasswordTab
          passwordForm={passwordForm}
          setPasswordForm={setPasswordForm}
          passwordSaving={passwordSaving}
          passwordSaved={passwordSaved}
          passwordError={passwordError}
          onSave={savePassword}
        />

        <NotificationsTab
          enabledNotifications={enabledNotifications}
          onToggle={toggleNotif}
          notifSaving={notifSaving}
          notifSaved={notifSaved}
          onSave={saveNotifications}
        />

        <DangerTab onOpenDelete={() => setDeleteDialogOpen(true)} />
      </Tabs>

      {/* Delete account dialog */}
      <DeleteAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        email={user?.email ?? ""}
      />
    </div>
  );
}
