"use client";

import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Phone, Lock, CreditCard } from "lucide-react";
import { CallControls } from "./CallControls";

export function CallCard({
  token,
  wsUrl,
  connecting,
  billingLoaded,
  isEnterprise,
  hasBalance,
  balanceCents,
  livekitUnavailable,
  connectFailed,
  onStart,
  onEnd,
  onTimeout,
  onTopUp,
  onRetry,
}: {
  token: string | null;
  wsUrl: string | null;
  connecting: boolean;
  billingLoaded: boolean;
  isEnterprise: boolean;
  hasBalance: boolean;
  balanceCents: number | null;
  livekitUnavailable: boolean;
  connectFailed: boolean;
  onStart: () => void;
  onEnd: () => void;
  onTimeout: () => void;
  onTopUp: () => void;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Browser Call</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[#6b6b6b]">
          Real-time browser call — speak directly with your AI agent.
        </p>

        {/* Balance indicator */}
        {billingLoaded && !isEnterprise && (
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
              hasBalance
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            {hasBalance ? (
              <>
                ✓ Balance: ${((balanceCents ?? 0) / 100).toFixed(2)} — calling
                will consume credit
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5 shrink-0" /> No credit — add
                balance to enable test calls
              </>
            )}
          </div>
        )}

        {livekitUnavailable && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Browser calls are not yet enabled for this account. Contact support
            to activate this feature.
          </div>
        )}

        {connectFailed && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-2">
            <p className="font-medium">No se pudo conectar con el agente.</p>
            <p className="text-xs text-red-600">
              El servidor de voz no respondió a tiempo. Verifica que el worker
              de VoiceOS esté activo en Render y que{" "}
              <code className="font-mono">LIVEKIT_URL</code> esté correctamente
              configurado en Vercel.
            </p>
            <Button size="sm" variant="outline" onClick={onRetry}>
              <Phone className="mr-2 h-3.5 w-3.5" /> Reintentar
            </Button>
          </div>
        )}

        {!token || !wsUrl ? (
          !connectFailed && (hasBalance || !billingLoaded) ? (
            <Button
              onClick={onStart}
              disabled={connecting || !billingLoaded || livekitUnavailable}
            >
              {connecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  <Phone className="mr-2 h-4 w-4" />
                  Start Call
                </>
              )}
            </Button>
          ) : !connectFailed ? (
            // Locked state — no balance
            <div className="space-y-3">
              <Button
                variant="outline"
                className="opacity-60 cursor-not-allowed border-dashed"
                onClick={onTopUp}
              >
                <Lock className="mr-2 h-4 w-4 text-amber-500" />
                Start Call
                <span className="ml-2 text-[10px] text-amber-600 font-normal">
                  (No Credit)
                </span>
              </Button>
              <Button variant="default" className="ml-2" onClick={onTopUp}>
                <CreditCard className="mr-2 h-4 w-4" />
                Add Credit to Enable
              </Button>
            </div>
          ) : null
        ) : (
          <LiveKitRoom
            token={token}
            serverUrl={wsUrl}
            connect={true}
            audio={true}
            video={false}
            onDisconnected={onEnd}
          >
            <RoomAudioRenderer />
            <CallControls onEnd={onEnd} onTimeout={onTimeout} />
          </LiveKitRoom>
        )}
      </CardContent>
    </Card>
  );
}
