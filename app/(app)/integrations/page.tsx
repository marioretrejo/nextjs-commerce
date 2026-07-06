"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Integration, IntegrationType } from "@/lib/supabase/types";
import { RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { INTEGRATIONS, CREDENTIAL_TYPES } from "./_components/catalogue";
import { CredentialCard } from "./_components/CredentialCard";
import { GenericCard } from "./_components/GenericCard";
import { WebhookCard } from "./_components/WebhookCard";

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<
    Record<IntegrationType, Integration | null>
  >({} as Record<IntegrationType, Integration | null>);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<IntegrationType | null>(null);
  const [workspaceId, setWorkspaceId] = useState("");

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [savingWebhook, setSavingWebhook] = useState(false);

  // Load workspace ID
  useEffect(() => {
    fetch("/api/admin/workspace-id")
      .then((r) => r.json())
      .then((d: { workspace_id: string }) =>
        setWorkspaceId(d.workspace_id ?? ""),
      )
      .catch(() => toast.error("Failed to load workspace"));
  }, []);

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations");
      if (!res.ok) {
        toast.error("Failed to load integrations");
        setLoading(false);
        return;
      }
      const d = (await res.json()) as { integrations: Integration[] };
      const map: Record<string, Integration | null> = {};
      INTEGRATIONS.forEach((i) => {
        map[i.type] = null;
      });
      (d.integrations ?? []).forEach((i) => {
        map[i.type] = i;
      });
      setIntegrations(map as Record<IntegrationType, Integration | null>);

      const webhook = (d.integrations ?? []).find((i) => i.type === "webhook");
      if (webhook) {
        setWebhookUrl(webhook.webhook_url ?? "");
        setWebhookEvents(webhook.webhook_events ?? []);
      }
    } catch {
      toast.error("Network error loading integrations");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // ── Generic connect/disconnect (OAuth-style) ─────────────────────────────
  async function connect(type: IntegrationType) {
    setConnecting(type);
    try {
      const res = await fetch("/api/integrations/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(d.error ?? "Failed to connect");
      } else {
        const d = (await res.json()) as { redirect_url?: string };
        if (d.redirect_url) {
          window.location.href = d.redirect_url;
          return;
        }
        toast.success(`${type} connected`);
        await fetchIntegrations();
      }
    } catch {
      toast.error("Network error — could not connect");
    }
    setConnecting(null);
  }

  async function disconnect(type: IntegrationType) {
    setConnecting(type);
    try {
      const res = await fetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        toast.error("Failed to disconnect");
      } else {
        toast.success(`${type} disconnected`);
        await fetchIntegrations();
      }
    } catch {
      toast.error("Network error — could not disconnect");
    }
    setConnecting(null);
  }

  // ── Credential form save (for Telegram, Teams, n8n, Google Calendar) ─────
  async function saveCredentials(
    type: IntegrationType,
    fields: Record<string, string>,
  ) {
    if (!workspaceId) {
      toast.error("Workspace not loaded — please refresh");
      return;
    }
    const def = INTEGRATIONS.find((i) => i.type === type)!;
    const webhookFieldId = def.webhookField;

    const credentials: Record<string, string> = {};
    let webhook_url: string | null = null;

    for (const [k, v] of Object.entries(fields)) {
      if (k === webhookFieldId) webhook_url = v;
      else credentials[k] = v;
    }
    // For Teams/n8n where all data is a URL, also store in credentials for redundancy
    if (webhookFieldId && fields[webhookFieldId]) {
      credentials[webhookFieldId] = fields[webhookFieldId]!;
    }

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          type,
          status: "connected",
          credentials,
          webhook_url,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(d.error ?? "Failed to save integration");
        return;
      }
      toast.success(`${def.name} connected`);
      await fetchIntegrations();
    } catch {
      toast.error("Network error — could not save integration");
    }
  }

  async function disconnectCredential(type: IntegrationType) {
    try {
      const res = await fetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        toast.error("Failed to disconnect");
        return;
      }
      toast.success("Integration disconnected");
      await fetchIntegrations();
    } catch {
      toast.error("Network error — could not disconnect");
    }
  }

  async function saveWebhook() {
    setSavingWebhook(true);
    try {
      const res = await fetch("/api/integrations/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook_url: webhookUrl,
          webhook_events: webhookEvents,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(d.error ?? "Failed to save webhook");
      } else {
        toast.success(
          "Webhook saved — events will fire after each analyzed call",
        );
        await fetchIntegrations();
      }
    } catch {
      toast.error("Network error — could not save webhook");
    }
    setSavingWebhook(false);
  }

  function toggleWebhookEvent(eventId: string) {
    setWebhookEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((e) => e !== eventId)
        : [...prev, eventId],
    );
  }

  // Separate integrations into categories
  const notifAndAutomation = INTEGRATIONS.filter(
    (i) => !i.isWebhook && !i.comingSoon && CREDENTIAL_TYPES.has(i.type),
  );
  const crmAndOthers = INTEGRATIONS.filter(
    (i) => !i.isWebhook && !CREDENTIAL_TYPES.has(i.type),
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">
            Integrations
          </h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            Connect your tools. Post-call events fire automatically after every
            analyzed call.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchIntegrations}
          disabled={loading}
        >
          <RefreshCw
            className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* ── Notifications & Automation (credential-based) ────────────────────── */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-[#6b6b6b] uppercase tracking-wide mb-3 flex items-center gap-2">
          <Send className="w-3.5 h-3.5" />
          Post-Call Notifications &amp; Automation
        </h2>
        <p className="text-xs text-[#6b6b6b] mb-4">
          These integrations fire automatically after each call is analyzed — no
          extra work required.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-44 bg-[#f5f5f5] rounded-xl animate-pulse"
                />
              ))
            : notifAndAutomation.map((def) => (
                <CredentialCard
                  key={def.type}
                  def={def}
                  integration={integrations[def.type] ?? null}
                  onSave={saveCredentials}
                  onDisconnect={disconnectCredential}
                />
              ))}
        </div>
      </div>

      <Separator className="my-6" />

      {/* ── CRM & Other ──────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-[#6b6b6b] uppercase tracking-wide mb-3">
          CRM &amp; Platforms
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-44 bg-[#f5f5f5] rounded-xl animate-pulse"
                />
              ))
            : crmAndOthers
                .filter((i) => !i.isWebhook)
                .map((def) => (
                  <GenericCard
                    key={def.type}
                    def={def}
                    integration={integrations[def.type] ?? null}
                    onConnect={connect}
                    onDisconnect={disconnect}
                    busy={connecting === def.type}
                  />
                ))}
        </div>
      </div>

      <Separator className="my-6" />

      {/* ── Custom Webhook ───────────────────────────────────────────────────── */}
      <WebhookCard
        webhookUrl={webhookUrl}
        webhookEvents={webhookEvents}
        savingWebhook={savingWebhook}
        onUrlChange={setWebhookUrl}
        onToggleEvent={toggleWebhookEvent}
        onSave={saveWebhook}
      />
    </div>
  );
}
