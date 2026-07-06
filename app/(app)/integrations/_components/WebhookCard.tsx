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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Webhook } from "lucide-react";
import { WEBHOOK_EVENTS } from "./catalogue";

export function WebhookCard({
  webhookUrl,
  webhookEvents,
  savingWebhook,
  onUrlChange,
  onToggleEvent,
  onSave,
}: {
  webhookUrl: string;
  webhookEvents: string[];
  savingWebhook: boolean;
  onUrlChange: (url: string) => void;
  onToggleEvent: (eventId: string) => void;
  onSave: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#f5f5f5] border border-[#e0e0e0] flex items-center justify-center">
            <Webhook className="w-5 h-5 text-[#0a0a0a]" />
          </div>
          <div>
            <CardTitle className="text-sm">Custom Webhook</CardTitle>
            <CardDescription className="text-xs">
              Receive real-time POST events to any endpoint. Manage multiple
              endpoints →
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Separator className="mb-4" />
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Endpoint URL</Label>
            <Input
              id="webhook-url"
              placeholder="https://your-server.com/webhooks/voiceos"
              value={webhookUrl}
              onChange={(e) => onUrlChange(e.target.value)}
            />
            <p className="text-xs text-[#6b6b6b]">
              We'll POST a JSON payload for each selected event.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Events</Label>
            <div className="grid grid-cols-2 gap-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <div key={ev.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`ev-${ev.id}`}
                    checked={webhookEvents.includes(ev.id)}
                    onCheckedChange={() => onToggleEvent(ev.id)}
                  />
                  <Label
                    htmlFor={`ev-${ev.id}`}
                    className="text-xs font-normal cursor-pointer"
                  >
                    {ev.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            onClick={onSave}
            disabled={savingWebhook || !webhookUrl.trim()}
          >
            {savingWebhook ? "Saving…" : "Save Webhook"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
