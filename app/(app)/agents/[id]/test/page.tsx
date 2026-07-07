"use client";

import "@livekit/components-styles";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bot } from "lucide-react";
import Link from "next/link";
import { use, useState, useEffect } from "react";
import { toast } from "sonner";
import { TopUpModal } from "@/components/billing/TopUpModal";
import { CallCard } from "./_components/CallCard";

export default function TestAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("Agent");
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [connecting, setConnecting] = useState(false);
  const [livekitUnavailable, setLivekitUnavailable] = useState(false);
  const [connectFailed, setConnectFailed] = useState(false);

  // Billing state — fetched client-side so we don't need SSR props
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [minuteCap, setMinuteCap] = useState<number | null | undefined>(
    undefined,
  );
  const [topUpOpen, setTopUpOpen] = useState(false);

  // Determine if the workspace has funds to make a call
  const isEnterprise = minuteCap !== null && minuteCap !== undefined;
  const hasBalance =
    isEnterprise || (balanceCents !== null && balanceCents > 0);
  const billingLoaded = balanceCents !== null || isEnterprise;

  useEffect(() => {
    fetch("/api/billing/balance")
      .then((r) => r.json())
      .then(
        (d: {
          balance_cents?: number;
          minute_cap?: number | null;
          workspace_id?: string;
        }) => {
          setBalanceCents(d.balance_cents ?? 0);
          setMinuteCap(d.minute_cap ?? null);
          setWorkspaceId(d.workspace_id ?? "");
        },
      )
      .catch(() => {
        setBalanceCents(0);
        setMinuteCap(null);
      });
  }, []);

  async function startCall() {
    if (!hasBalance) {
      setTopUpOpen(true);
      return;
    }
    setConnecting(true);
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: id }),
      });
      if (!res.ok) {
        let errMsg = "Call setup failed — please try again.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) errMsg = body.error;
        } catch {
          /* response was not JSON (e.g. gateway timeout) */
        }
        if (errMsg === "LiveKit not configured") {
          setLivekitUnavailable(true);
          return;
        }
        throw new Error(errMsg);
      }
      const data = (await res.json()) as {
        token: string;
        wsUrl: string;
        agentName: string;
      };

      // Validate response fields before passing to LiveKit — prevents the
      // "SyntaxError: The string did not match the expected pattern" that
      // iOS Safari throws when LiveKitRoom receives an undefined/invalid URL.
      if (!data.wsUrl || !data.wsUrl.startsWith("wss://")) {
        throw new Error(
          "Call setup failed — invalid server URL returned. Please try again.",
        );
      }
      if (!data.token) {
        throw new Error(
          "Call setup failed — no token returned. Please try again.",
        );
      }

      setWsUrl(data.wsUrl);
      setAgentName(data.agentName ?? "Agent");
      setToken(data.token);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setConnecting(false);
    }
  }

  function endCall() {
    setToken(null);
    setWsUrl(null);
    setConnectFailed(false);
  }

  function handleConnectTimeout() {
    endCall();
    setConnectFailed(true);
  }

  return (
    <div className="p-6 mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/agents/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <h1 className="text-xl font-bold">Test Agent — {agentName}</h1>
        </div>
      </div>

      <CallCard
        token={token}
        wsUrl={wsUrl}
        connecting={connecting}
        billingLoaded={billingLoaded}
        isEnterprise={isEnterprise}
        hasBalance={hasBalance}
        balanceCents={balanceCents}
        livekitUnavailable={livekitUnavailable}
        connectFailed={connectFailed}
        onStart={startCall}
        onEnd={endCall}
        onTimeout={handleConnectTimeout}
        onTopUp={() => setTopUpOpen(true)}
        onRetry={() => {
          setConnectFailed(false);
          startCall();
        }}
      />

      <TopUpModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        workspaceId={workspaceId}
      />
    </div>
  );
}
