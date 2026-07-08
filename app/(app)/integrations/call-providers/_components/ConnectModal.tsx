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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CopyField } from "./CopyField";
import {
  PROVIDER_OPTIONS,
  METHOD_OPTIONS,
  resolveWebhookUrl,
  type AgentOption,
  type CallProviderIntegrationDTO,
} from "./types";

const selectClass =
  "h-9 w-full rounded-md border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]";

export function ConnectModal({
  open,
  onClose,
  onCreated,
  agents,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  agents: AgentOption[];
}) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("squaretalk");
  const [method, setMethod] = useState("webhook_receiver");
  const [defaultAgentId, setDefaultAgentId] = useState("");
  const [defaultDepartment, setDefaultDepartment] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{
    integration: CallProviderIntegrationDTO;
    secret: string;
  } | null>(null);

  function reset() {
    setName("");
    setProvider("squaretalk");
    setMethod("webhook_receiver");
    setDefaultAgentId("");
    setDefaultDepartment("");
    setApiKey("");
    setCreated(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit() {
    if (!name.trim()) {
      toast.error("Integration name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/call-provider-integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          provider,
          connection_method: method,
          default_agent_id: defaultAgentId || null,
          default_department: defaultDepartment.trim() || null,
          credentials:
            method === "api_sync" && apiKey.trim()
              ? { api_key: apiKey.trim() }
              : {},
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        integration?: CallProviderIntegrationDTO;
        webhook_secret?: string;
        error?: string;
      };
      if (!res.ok || !data.integration || !data.webhook_secret) {
        toast.error(data.error ?? "Failed to create integration");
        return;
      }
      setCreated({
        integration: data.integration,
        secret: data.webhook_secret,
      });
      toast.success("Call provider connected");
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          if (created) onCreated();
          close();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        {!created ? (
          <>
            <DialogHeader>
              <DialogTitle>Connect Call Provider</DialogTitle>
              <DialogDescription>
                Import completed calls from an external provider into your QA
                Center.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="cp-name">Integration name</Label>
                <Input
                  id="cp-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Squaretalk — Conversion team"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Provider</Label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className={`mt-1 ${selectClass}`}
                  >
                    {PROVIDER_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Connection method</Label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className={`mt-1 ${selectClass}`}
                  >
                    {METHOD_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Default agent</Label>
                  <select
                    value={defaultAgentId}
                    onChange={(e) => setDefaultAgentId(e.target.value)}
                    className={`mt-1 ${selectClass}`}
                  >
                    <option value="">Auto (match by name)</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="cp-dept">Default department</Label>
                  <Input
                    id="cp-dept"
                    value={defaultDepartment}
                    onChange={(e) => setDefaultDepartment(e.target.value)}
                    placeholder="Optional"
                    className="mt-1"
                  />
                </div>
              </div>

              {method === "api_sync" && (
                <div>
                  <Label htmlFor="cp-key">API key</Label>
                  <Input
                    id="cp-key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Provider API key (API Sync — coming soon)"
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-[#6b6b6b]">
                    API Sync polling is not enabled yet — you can still store
                    credentials now.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? "Connecting…" : "Connect"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Integration created</DialogTitle>
              <DialogDescription>
                Point your provider or n8n flow at this URL. The secret is shown
                only once — copy it now.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <CopyField
                label="Webhook URL (POST)"
                value={resolveWebhookUrl(created.integration)}
              />
              <CopyField
                label="Required header"
                value="x-voiceop-import-secret"
                mono
              />
              <CopyField label="Secret" value={created.secret} />
            </div>

            <DialogFooter>
              <Button
                onClick={() => {
                  onCreated();
                  close();
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
