import type { Dispatch, SetStateAction } from "react";
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
import { TabsContent } from "@/components/ui/tabs";
import { Check } from "lucide-react";
import type { PasswordForm } from "./constants";

export function PasswordTab({
  passwordForm,
  setPasswordForm,
  passwordSaving,
  passwordSaved,
  passwordError,
  onSave,
}: {
  passwordForm: PasswordForm;
  setPasswordForm: Dispatch<SetStateAction<PasswordForm>>;
  passwordSaving: boolean;
  passwordSaved: boolean;
  passwordError: string;
  onSave: () => void;
}) {
  return (
    <TabsContent value="password">
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your account password. Use a strong, unique password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">Current Password</Label>
            <Input
              id="pw-current"
              type="password"
              value={passwordForm.current}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, current: e.target.value }))
              }
              placeholder="Your current password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">New Password</Label>
            <Input
              id="pw-new"
              type="password"
              value={passwordForm.next}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, next: e.target.value }))
              }
              placeholder="At least 8 characters"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-confirm">Confirm New Password</Label>
            <Input
              id="pw-confirm"
              type="password"
              value={passwordForm.confirm}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, confirm: e.target.value }))
              }
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
              onClick={onSave}
              disabled={
                passwordSaving || !passwordForm.current || !passwordForm.next
              }
            >
              {passwordSaved ? (
                <>
                  <Check className="w-4 h-4 mr-1" /> Updated
                </>
              ) : passwordSaving ? (
                "Updating…"
              ) : (
                "Update Password"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
