"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Webhook, Loader2 } from "lucide-react";
import { ALL_EVENTS, type Endpoint } from "./types";
import { SecretBlock } from "./SecretBlock";

export function AddWebhookModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (endpoint: Endpoint & { secret: string }) => void;
}) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["call.completed"]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [created, setCreated] = useState<Endpoint | null>(null);

  function toggleEvent(value: string) {
    setEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url || !events.length) return;
    setLoading(true);
    try {
      const res = await fetch("/api/webhooks/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          events,
          description: description || undefined,
        }),
      });
      const data = (await res.json()) as
        | (Endpoint & { secret: string })
        | { error: string };
      if (!res.ok) {
        toast.error((data as { error: string }).error);
        return;
      }
      const row = data as Endpoint & { secret: string };
      setSecret(row.secret);
      setCreated(row);
      onCreated(row);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setUrl("");
    setEvents(["call.completed"]);
    setDescription("");
    setSecret(null);
    setCreated(null);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4" /> Add Webhook Endpoint
          </DialogTitle>
          <DialogDescription className="text-xs text-[#6b6b6b]">
            VoiceOS will POST signed JSON events to your endpoint URL.
          </DialogDescription>
        </DialogHeader>

        {secret && created ? (
          <SecretBlock secret={secret} onDone={handleClose} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* URL */}
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-[#0a0a0a]"
                htmlFor="wh-url"
              >
                Endpoint URL <span className="text-red-500">*</span>
              </label>
              <input
                id="wh-url"
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-app.com/webhooks/voiceos"
                className="w-full h-9 rounded-lg border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] placeholder:text-[#c0c0c0] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/20 focus:border-[#0a0a0a]"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-[#0a0a0a]"
                htmlFor="wh-desc"
              >
                Description{" "}
                <span className="text-[#a0a0a0] font-normal">(optional)</span>
              </label>
              <input
                id="wh-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Zapier bridge, HubSpot CRM sync"
                className="w-full h-9 rounded-lg border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] placeholder:text-[#c0c0c0] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/20 focus:border-[#0a0a0a]"
              />
            </div>

            {/* Events */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#0a0a0a]">
                Events to subscribe to
              </p>
              <div className="space-y-2">
                {ALL_EVENTS.map((ev) => (
                  <label
                    key={ev.value}
                    className="flex items-start gap-3 cursor-pointer rounded-lg border border-[#e5e5e5] p-3 hover:bg-[#fafafa] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={events.includes(ev.value)}
                      onChange={() => toggleEvent(ev.value)}
                      className="mt-0.5 h-3.5 w-3.5 accent-[#0a0a0a] shrink-0"
                    />
                    <div>
                      <p className="text-xs font-medium text-[#0a0a0a]">
                        {ev.label}
                      </p>
                      <p className="text-[11px] text-[#6b6b6b] mt-0.5">
                        {ev.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              {events.length === 0 && (
                <p className="text-xs text-red-500">
                  Select at least one event.
                </p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading || !url || events.length === 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create Endpoint"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
