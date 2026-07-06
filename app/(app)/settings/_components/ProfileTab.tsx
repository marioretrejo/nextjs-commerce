import type { Dispatch, SetStateAction } from "react";
import { useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar } from "@/components/ui/avatar";
import { TabsContent } from "@/components/ui/tabs";
import { Upload, Check } from "lucide-react";
import type { User } from "@/lib/supabase/types";
import { TIMEZONES, LANGUAGES, type ProfileForm } from "./constants";

export function ProfileTab({
  user,
  initials,
  profileForm,
  setProfileForm,
  profileSaving,
  profileSaved,
  avatarUploading,
  onSave,
  onUploadAvatar,
}: {
  user: User | null;
  initials: string;
  profileForm: ProfileForm;
  setProfileForm: Dispatch<SetStateAction<ProfileForm>>;
  profileSaving: boolean;
  profileSaved: boolean;
  avatarUploading: boolean;
  onSave: () => void;
  onUploadAvatar: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <TabsContent value="profile">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Update your personal information and preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 bg-[#0a0a0a] text-white text-lg font-semibold flex items-center justify-center">
              {user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- user-supplied avatar URL from arbitrary origins; next/image remote config is impractical here
                <img
                  src={user.avatar_url}
                  alt="Avatar"
                  className="w-full h-full object-cover rounded-full"
                />
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
                {avatarUploading ? "Uploading…" : "Upload Photo"}
              </Button>
              <p className="text-xs text-[#6b6b6b] mt-1">
                JPG, PNG, GIF up to 4 MB.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadAvatar(f);
              }}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pf-name">Full Name</Label>
              <Input
                id="pf-name"
                value={profileForm.name}
                onChange={(e) =>
                  setProfileForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Your name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-company">Company</Label>
              <Input
                id="pf-company"
                value={profileForm.company}
                onChange={(e) =>
                  setProfileForm((f) => ({ ...f, company: e.target.value }))
                }
                placeholder="Your company"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-tz">Timezone</Label>
              <select
                id="pf-tz"
                value={profileForm.timezone}
                onChange={(e) =>
                  setProfileForm((f) => ({
                    ...f,
                    timezone: e.target.value,
                  }))
                }
                className="w-full h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-lang">Language</Label>
              <select
                id="pf-lang"
                value={profileForm.language}
                onChange={(e) =>
                  setProfileForm((f) => ({
                    ...f,
                    language: e.target.value,
                  }))
                }
                className="w-full h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={onSave} disabled={profileSaving}>
              {profileSaved ? (
                <>
                  <Check className="w-4 h-4 mr-1" /> Saved
                </>
              ) : profileSaving ? (
                "Saving…"
              ) : (
                "Save Profile"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
