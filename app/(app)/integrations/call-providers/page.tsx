"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, PhoneIncoming } from "lucide-react";
import { toast } from "sonner";
import { ConnectModal } from "./_components/ConnectModal";
import { ProviderCard } from "./_components/ProviderCard";
import type {
  AgentOption,
  CallProviderIntegrationDTO,
} from "./_components/types";

export default function CallProvidersPage() {
  const [integrations, setIntegrations] = useState<
    CallProviderIntegrationDTO[]
  >([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/call-provider-integrations");
    if (res.ok) {
      const data = (await res.json()) as {
        integrations: CallProviderIntegrationDTO[];
      };
      setIntegrations(data.integrations ?? []);
    } else {
      toast.error("Failed to load call providers");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetch("/api/admin/workspace-id")
      .then((r) => r.json())
      .then((d: { workspace_id?: string }) => {
        if (!d.workspace_id) return;
        return fetch(`/api/agents?workspace_id=${d.workspace_id}`)
          .then((r) => (r.ok ? r.json() : []))
          .then((rows: Array<{ id: string; name: string }>) =>
            setAgents((rows ?? []).map((a) => ({ id: a.id, name: a.name }))),
          );
      })
      .catch(() => undefined);
  }, []);

  const agentNameById = (id: string | null): string | null =>
    id ? (agents.find((a) => a.id === id)?.name ?? null) : null;

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/integrations">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">
              Call Providers
            </h1>
            <p className="mt-1 text-sm text-[#6b6b6b]">
              Import completed calls from Squaretalk, Voiso, CommPeak, n8n, or a
              custom webhook into your QA Center.
            </p>
          </div>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Connect Call Provider
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="h-5 w-48 animate-pulse rounded bg-[#f5f5f5]" />
                <div className="mt-3 h-9 w-full animate-pulse rounded bg-[#f5f5f5]" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : integrations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <PhoneIncoming className="mb-4 h-12 w-12 text-[#e0e0e0]" />
            <p className="mb-1 font-medium text-[#0a0a0a]">
              No call providers connected
            </p>
            <p className="mb-4 max-w-sm text-sm text-[#6b6b6b]">
              Connect a provider to start importing calls. You&apos;ll get a
              webhook URL and secret to configure in your platform or n8n.
            </p>
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Connect Call Provider
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {integrations.map((integration) => (
            <ProviderCard
              key={integration.id}
              integration={integration}
              agentName={agentNameById(integration.default_agent_id)}
              onChanged={load}
            />
          ))}
        </div>
      )}

      <ConnectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={load}
        agents={agents}
      />
    </div>
  );
}
