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
import { ArrowLeft, Loader2, Mic, MicOff, Phone, PhoneOff, Bot } from 'lucide-react';
import Link from 'next/link';
import { use, useState, useCallback } from 'react';
import { toast } from 'sonner';

// --- Inner room UI (mounted only when token/wsUrl are ready) ---
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
      {/* Visualizer */}
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

      {/* State badge */}
      {agentJoined && (
        <div className="flex items-center gap-2 text-sm text-[#6b6b6b]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          {stateLabel[agentState] ?? agentState}
        </div>
      )}

      {/* Controls */}
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
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [agentName, setAgentName] = useState('Agent');
  const [connecting, setConnecting] = useState(false);

  async function startCall() {
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

  function endCall() {
    setToken(null);
    setWsUrl(null);
  }

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

          {!token || !wsUrl ? (
            <Button onClick={startCall} disabled={connecting}>
              {connecting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting…</>
                : <><Phone className="mr-2 h-4 w-4" />Start Call</>}
            </Button>
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
    </div>
  );
}
