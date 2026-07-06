"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Webhook, Plus, RefreshCw, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import type { Endpoint } from "./_components/types";
import { AddWebhookModal } from "./_components/AddWebhookModal";
import { HowItWorks } from "./_components/HowItWorks";
import { EndpointCard } from "./_components/EndpointCard";

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/webhooks/endpoints");
      const json = (await res.json()) as { data: Endpoint[] };
      setEndpoints(json.data ?? []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleCreated(ep: Endpoint & { secret: string }) {
    setEndpoints((prev) => [{ ...ep }, ...prev]);
  }

  async function deleteEndpoint(id: string, url: string) {
    if (!confirm(`Delete webhook endpoint?\n${url}`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/webhooks/endpoints/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to delete.");
        return;
      }
      setEndpoints((prev) => prev.filter((e) => e.id !== id));
      toast.success("Endpoint deleted.");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setDeleting(null);
    }
  }

  async function toggleActive(ep: Endpoint) {
    setToggling(ep.id);
    try {
      const res = await fetch(`/api/webhooks/endpoints/${ep.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !ep.is_active }),
      });
      if (!res.ok) {
        toast.error("Failed to update.");
        return;
      }
      setEndpoints((prev) =>
        prev.map((e) =>
          e.id === ep.id ? { ...e, is_active: !ep.is_active } : e,
        ),
      );
    } catch (err) {
      toast.error(String(err));
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-[#a0a0a0]">
        <Link
          href="/integrations"
          className="hover:text-[#0a0a0a] transition-colors"
        >
          Integrations
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-[#0a0a0a] font-medium">Webhooks</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0a0a0a] flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Endpoints
          </h1>
          <p className="text-sm text-[#6b6b6b] mt-0.5">
            VoiceOS sends signed HTTP POST requests to your endpoints when
            events occur.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="rounded-lg border border-[#e5e5e5] p-2 hover:bg-[#f5f5f5] transition-colors"
            title="Refresh"
          >
            <RefreshCw
              className={`h-4 w-4 text-[#6b6b6b] ${loading ? "animate-spin" : ""}`}
            />
          </button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Endpoint
          </Button>
        </div>
      </div>

      {/* How it works */}
      <HowItWorks />

      {/* Endpoints table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-[#a0a0a0]">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading endpoints…
        </div>
      ) : endpoints.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e0e0e0] py-16 text-center">
          <Webhook className="h-8 w-8 text-[#d0d0d0] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#0a0a0a]">
            No webhook endpoints yet
          </p>
          <p className="text-xs text-[#6b6b6b] mt-1 mb-4">
            Add your first endpoint to start receiving call data in your CRM or
            automation tool.
          </p>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Endpoint
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {endpoints.map((ep) => (
            <EndpointCard
              key={ep.id}
              ep={ep}
              toggling={toggling === ep.id}
              deleting={deleting === ep.id}
              onToggle={toggleActive}
              onDelete={deleteEndpoint}
            />
          ))}
        </div>
      )}

      <AddWebhookModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
