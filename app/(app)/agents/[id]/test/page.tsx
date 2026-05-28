'use client';

import '@livekit/components-styles';
import type { AgentState } from '@livekit/components-react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useVoiceAssistant,
  BarVisualizer,
} from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Mic, MicOff, Phone, PhoneOff, Bot, Lock, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { use, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { TopUpModal } from '@/components/billing/TopUpModal';

// --- Inner room UI ---
function CallControls({ onEnd }: { onEnd: () => void }) {
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const { state: agentState, audioTrack } = useVoiceAssistant();

  const isConnected = connectionState === ConnectionState.Connected;
  const agentJoined = remoteParticipants.length > 0;
  const isMuted = localParticipant.isMicrophoneEnabled === false;

  const toggleMic = useCallback(() => {
    localParticipant.setMicrophoneEnabled(isMuted);
  }, [localParticipant, isMuted]);

  const stateLabel: Partial<Record<AgentState, string>> = {
    disconnected: 'Disconnected',
    connecting: 'Connecting…',
    initializing: 'Initializing…',
    listening: 'Listening',
    thinking: 'Thinking…',
    speaking: 'Speaking',
    idle: 'Ready',
    failed: 'Failed',
  };

  return (
    <div className="space-y-4">
      <div className="h-20 rounded-lg bg-[#0a0a0a] flex items-center justify-center overflow-hidden px-4">
        {agentJoined && audioTrack ? (
          <BarVisualizer
            state={agentState}
            trackRef={audioTrack}
            barCount={32}
            className="h-full w-full"
            options={{ minHeight: 3 }}
          />
        ) : (
          <div className="flex items-center gap-2 text-[#6b6b6b] text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isConnected ? 'Waiting for agent…' : 'Connecting…'}
          </div>
        )}
      </div>

      {agentJoined && (
        <div className="flex items-center gap-2 text-sm text-[#6b6b6b]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          {stateLabel[agentState] ?? agentState}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="bg-[#0a0a0a] text-white hover:bg-[#262626]"
          onClick={onEnd}
        >
          <PhoneOff className="mr-2 h-4 w-4" /> End Call
        </Button>
        <Button variant="secondary" onClick={toggleMic}>
          {isMuted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
          {isMuted ? 'Unmute' : 'Mute'}
        </Button>
      </div>
    </div>
  );
}

// --- Main page ---
export default function TestAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [token, setToken]         = useState<string | null>(null);
  const [wsUrl, setWsUrl]         = useState<string | null>(null);
  const [agentName, setAgentName] = useState('Agent');
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [connecting, setConnecting] = useState(false);

  // Billing state — fetched client-side so we don't need SSR props
  const [balanceCents, setBalanceCents]   = useState<number | null>(null);
  const [minuteCap, setMinuteCap]         = useState<number | null | undefined>(undefined);
  const [topUpOpen, setTopUpOpen]         = useState(false);

  // Determine if the workspace has funds to make a call
  const isEnterprise = minuteCap !== null && minuteCap !== undefined;
  const hasBalance   = isEnterprise || (balanceCents !== null && balanceCents > 0);
  const billingLoaded = balanceCents !== null || isEnterprise;

  useEffect(() => {
    fetch('/api/billing/balance')
      .then(r => r.json())
      .then((d: { balance_cents?: number; minute_cap?: number | null; workspace_id?: string }) => {
        setBalanceCents(d.balance_cents ?? 0);
        setMinuteCap(d.minute_cap ?? null);
        setWorkspaceId(d.workspace_id ?? '');
      })
      .catch(() => { setBalanceCents(0); setMinuteCap(null); });
  }, []);

  async function startCall() {
    if (!hasBalance) { setTopUpOpen(true); return; }
    setConnecting(true);
    try {
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: id }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      const data = await res.json() as { token: string; wsUrl: string; agentName: string };
      setWsUrl(data.wsUrl);
      setAgentName(data.agentName);
      setToken(data.token);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setConnecting(false);
    }
  }

  function endCall() { setToken(null); setWsUrl(null); }

  return (
    <div className="p-6 mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/agents/${id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <h1 className="text-xl font-bold">Test Agent — {agentName}</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Browser Call</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[#6b6b6b]">
            Real-time WebRTC call powered by{' '}
            <strong>Deepgram</strong> (STT) · <strong>Groq / Llama 4</strong> (LLM) · <strong>Cartesia sonic-3</strong> (TTS)
          </p>

          {/* Balance indicator */}
          {billingLoaded && !isEnterprise && (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
              hasBalance ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {hasBalance
                ? <>✓ Balance: ${((balanceCents ?? 0) / 100).toFixed(2)} — calling will consume credit</>
                : <><Lock className="h-3.5 w-3.5 shrink-0" /> No credit — add balance to enable test calls</>
              }
            </div>
          )}

          {!token || !wsUrl ? (
            hasBalance || !billingLoaded ? (
              <Button onClick={startCall} disabled={connecting || !billingLoaded}>
                {connecting
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting…</>
                  : <><Phone className="mr-2 h-4 w-4" />Start Call</>}
              </Button>
            ) : (
              // Locked state — no balance
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="opacity-60 cursor-not-allowed border-dashed"
                  onClick={() => setTopUpOpen(true)}
                >
                  <Lock className="mr-2 h-4 w-4 text-amber-500" />
                  Start Call
                  <span className="ml-2 text-[10px] text-amber-600 font-normal">(No Credit)</span>
                </Button>
                <Button
                  variant="default"
                  className="ml-2"
                  onClick={() => setTopUpOpen(true)}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Add Credit to Enable
                </Button>
              </div>
            )
          ) : (
            <LiveKitRoom
              token={token}
              serverUrl={wsUrl}
              connect={true}
              audio={true}
              video={false}
              onDisconnected={endCall}
            >
              <RoomAudioRenderer />
              <CallControls onEnd={endCall} />
            </LiveKitRoom>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <p className="text-xs text-[#6b6b6b]">
            <strong>Stack:</strong> LiveKit (WebRTC transport) · Deepgram nova-3 (Speech-to-Text) ·
            Groq Llama 4 Scout (LLM, ~200ms) · Cartesia sonic-3 (Text-to-Speech with emotion)
          </p>
        </CardContent>
      </Card>

      <TopUpModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        workspaceId={workspaceId}
      />
    </div>
  );
}
