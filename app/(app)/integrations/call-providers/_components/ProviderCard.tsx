"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { RefreshCw, Play, Trash2, ScrollText } from "lucide-react";
import { CopyField } from "./CopyField";
import {
  providerLabel,
  methodLabel,
  resolveWebhookUrl,
  type CallProviderIntegrationDTO,
  type ImportLogDTO,
} from "./types";

const STATUS_CLASS: Record<string, string> = {
  active: "bg-[#0a0a0a] text-white",
  paused: "bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]",
  disabled: "bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]",
  error: "bg-red-50 text-red-700 border-red-200",
};

const LOG_STATUS_CLASS: Record<string, string> = {
  success: "text-[#0a0a0a]",
  duplicate: "text-[#6b6b6b]",
  error: "text-red-600",
};

export function ProviderCard({
  integration,
  agentName,
  onChanged,
}: {
  integration: CallProviderIntegrationDTO;
  agentName: string | null;
  onChanged: () => void;
}) {
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<ImportLogDTO[] | null>(null);

  const isWebhook = integration.connection_method === "webhook_receiver";

  async function rotate() {
    if (
      !confirm(
        "Rotate the webhook secret? The current secret stops working immediately.",
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/call-provider-integrations/${integration.id}/rotate-secret`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        webhook_secret?: string;
        error?: string;
      };
      if (!res.ok || !data.webhook_secret) {
        toast.error(data.error ?? "Failed to rotate secret");
        return;
      }
      setRotatedSecret(data.webhook_secret);
      toast.success("Secret rotated — copy the new value");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/call-provider-integrations/${integration.id}/test`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (data.ok) toast.success(data.message ?? "Test passed");
      else toast.error(data.message ?? "Test failed");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${integration.name}"? This cannot be undone.`))
      return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/call-provider-integrations/${integration.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        toast.error("Failed to delete");
        return;
      }
      toast.success("Integration deleted");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function toggleLogs() {
    const next = !logsOpen;
    setLogsOpen(next);
    if (next && logs === null) {
      const res = await fetch(
        `/api/call-provider-integrations/${integration.id}/logs`,
      );
      if (res.ok) {
        const data = (await res.json()) as { logs: ImportLogDTO[] };
        setLogs(data.logs ?? []);
      } else {
        setLogs([]);
      }
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-[#0a0a0a] truncate">
                {integration.name}
              </p>
              <Badge
                className={`text-xs ${STATUS_CLASS[integration.status] ?? "bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]"}`}
              >
                {integration.status}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-[#6b6b6b]">
              {providerLabel(integration.provider)} ·{" "}
              {methodLabel(integration.connection_method)} ·{" "}
              {agentName ? `Agent: ${agentName}` : "Agent: auto"}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={test} disabled={busy}>
              <Play className="mr-1 h-3.5 w-3.5" />
              Test
            </Button>
            {isWebhook && (
              <Button
                variant="outline"
                size="sm"
                onClick={rotate}
                disabled={busy}
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                Rotate
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={remove}
              disabled={busy}
              aria-label="Delete integration"
            >
              <Trash2 className="h-4 w-4 text-[#6b6b6b]" />
            </Button>
          </div>
        </div>

        {integration.last_error && (
          <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {integration.last_error}
          </p>
        )}

        {/* Webhook details */}
        {isWebhook && (
          <div className="mt-4 space-y-3">
            <CopyField
              label="Webhook URL (POST)"
              value={resolveWebhookUrl(integration)}
            />
            {rotatedSecret ? (
              <CopyField label="New secret (copy now)" value={rotatedSecret} />
            ) : (
              <p className="text-xs text-[#6b6b6b]">
                Secret:{" "}
                <span className="font-mono">
                  {integration.webhook_secret_masked ?? "—"}
                </span>{" "}
                — rotate to reveal a new one.
              </p>
            )}
          </div>
        )}

        {/* Footer meta + logs toggle */}
        <div className="mt-4 flex items-center justify-between border-t border-[#f5f5f5] pt-3">
          <p className="text-xs text-[#6b6b6b]">
            {integration.last_event_at
              ? `Last event ${format(new Date(integration.last_event_at), "MMM d, HH:mm")}`
              : "No events yet"}
          </p>
          <button
            type="button"
            onClick={toggleLogs}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0a0a0a] hover:underline"
          >
            <ScrollText className="h-3.5 w-3.5" />
            {logsOpen ? "Hide logs" : "View logs"}
          </button>
        </div>

        {logsOpen && (
          <div className="mt-3 space-y-1.5">
            {logs === null ? (
              <p className="text-xs text-[#6b6b6b]">Loading…</p>
            ) : logs.length === 0 ? (
              <p className="text-xs text-[#6b6b6b]">No import logs yet.</p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-2 rounded-md border border-[#f5f5f5] px-3 py-2 text-xs"
                >
                  <span className="w-32 shrink-0 text-[#6b6b6b]">
                    {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                  </span>
                  <span
                    className={`w-16 shrink-0 font-medium ${LOG_STATUS_CLASS[log.status] ?? ""}`}
                  >
                    {log.status}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[#6b6b6b]">
                    {log.external_call_id ? `${log.external_call_id} — ` : ""}
                    {log.message ?? ""}
                  </span>
                  {log.call_id && (
                    <Link
                      href={`/calls/${log.call_id}`}
                      className="shrink-0 text-[#0a0a0a] hover:underline"
                    >
                      View call
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
