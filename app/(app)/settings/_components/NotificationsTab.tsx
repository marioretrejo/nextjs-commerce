import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { TabsContent } from "@/components/ui/tabs";
import { Check } from "lucide-react";
import type { NotificationType } from "@/lib/supabase/types";
import { NOTIFICATION_TYPES } from "./constants";

export function NotificationsTab({
  enabledNotifications,
  onToggle,
  notifSaving,
  notifSaved,
  onSave,
}: {
  enabledNotifications: NotificationType[];
  onToggle: (type: NotificationType) => void;
  notifSaving: boolean;
  notifSaved: boolean;
  onSave: () => void;
}) {
  return (
    <TabsContent value="notifications">
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Choose which events you want to be notified about.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {NOTIFICATION_TYPES.map((n) => (
              <div key={n.type} className="flex items-start gap-3 py-1">
                <Checkbox
                  id={`notif-${n.type}`}
                  checked={enabledNotifications.includes(n.type)}
                  onCheckedChange={() => onToggle(n.type)}
                  className="mt-0.5"
                />
                <div>
                  <Label
                    htmlFor={`notif-${n.type}`}
                    className="text-sm font-medium text-[#0a0a0a] cursor-pointer"
                  >
                    {n.label}
                  </Label>
                  <p className="text-xs text-[#6b6b6b] mt-0.5">
                    {n.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          <div className="flex justify-end">
            <Button onClick={onSave} disabled={notifSaving}>
              {notifSaved ? (
                <>
                  <Check className="w-4 h-4 mr-1" /> Saved
                </>
              ) : notifSaving ? (
                "Saving…"
              ) : (
                "Save Preferences"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
