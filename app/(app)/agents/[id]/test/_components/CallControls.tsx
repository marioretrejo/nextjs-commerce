"use client";

import type { AgentState } from "@livekit/components-react";
import {
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useVoiceAssistant,
  useTranscriptions,
  BarVisualizer,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Loader2, Mic, MicOff, PhoneOff } from "lucide-react";
import { useCallback, useEffect } from "react";

export function CallControls({
  onEnd,
  onTimeout,
}: {
  onEnd: () => void;
  onTimeout: () => void;
}) {
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const { state: agentState, audioTrack } = useVoiceAssistant();

  const isConnected = connectionState === ConnectionState.Connected;
  const agentJoined = remoteParticipants.length > 0;
  const isMuted = localParticipant.isMicrophoneEnabled === false;

  // Live transcription — all text streams (user STT + agent TTS)
  const transcriptions = useTranscriptions();
  // Agent TTS segments from voice assistant
  const { agentTranscriptions } = useVoiceAssistant();

  // Timeout: if not connected after 20s, notify parent
  useEffect(() => {
    if (isConnected) return;
    const t = setTimeout(onTimeout, 20_000);
    return () => clearTimeout(t);
  }, [isConnected, onTimeout]);

  const toggleMic = useCallback(() => {
    localParticipant.setMicrophoneEnabled(isMuted);
  }, [localParticipant, isMuted]);

  const stateLabel: Partial<Record<AgentState, string>> = {
    disconnected: "Disconnected",
    connecting: "Connecting…",
    initializing: "Initializing…",
    listening: "Listening",
    thinking: "Thinking…",
    speaking: "Speaking",
    idle: "Ready",
    failed: "Failed",
  };

  // Merge agent TTS segments + all text stream segments into a unified timeline
  type TranscriptLine = {
    id: string;
    speaker: "agent" | "user";
    text: string;
    final: boolean;
    ts: number;
  };
  const agentLines: TranscriptLine[] = agentTranscriptions.map((s) => ({
    id: `agent-${s.id}`,
    speaker: "agent",
    text: s.text,
    final: s.final ?? true,
    ts: s.firstReceivedTime ?? 0,
  }));
  // Text streams that are NOT from the agent cover user STT
  const agentIdentity = agentJoined
    ? (remoteParticipants[0]?.identity ?? "")
    : "";
  const userLines: TranscriptLine[] = transcriptions
    .filter((s) => s.participantInfo.identity !== agentIdentity)
    .map((s, i) => ({
      id: `user-${i}-${s.streamInfo?.id ?? i}`,
      speaker: "user",
      text: s.text,
      final: true,
      ts: s.streamInfo?.timestamp ?? 0,
    }));
  const allLines = [...agentLines, ...userLines].sort((a, b) => a.ts - b.ts);

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
            {isConnected ? "Waiting for agent…" : "Connecting…"}
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
          {isMuted ? (
            <MicOff className="mr-2 h-4 w-4" />
          ) : (
            <Mic className="mr-2 h-4 w-4" />
          )}
          {isMuted ? "Unmute" : "Mute"}
        </Button>
      </div>

      {/* Live transcript panel */}
      {isConnected && (
        <div className="rounded-lg border border-[#e0e0e0] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#e0e0e0] bg-[#fafafa]">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b6b]">
              Live Transcript
            </span>
            {agentJoined && (
              <span className="flex items-center gap-1 text-[10px] text-green-600">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                </span>
                Live
              </span>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-[#f5f5f5] bg-white">
            {allLines.length === 0 ? (
              <p className="px-4 py-3 text-xs text-[#b0b0b0] italic">
                Esperando transcripción…
              </p>
            ) : (
              allLines.map((line) => (
                <div
                  key={line.id}
                  className={`flex gap-2.5 px-3 py-2.5 ${line.speaker === "agent" ? "" : "flex-row-reverse"}`}
                >
                  <div
                    className={`h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold mt-0.5
                    ${line.speaker === "agent" ? "bg-[#0a0a0a] text-white" : "bg-[#e0e0e0] text-[#6b6b6b]"}`}
                  >
                    {line.speaker === "agent" ? "A" : "U"}
                  </div>
                  <p
                    className={`text-xs leading-relaxed max-w-[85%] ${!line.final ? "text-[#a0a0a0] italic" : "text-[#1a1a1a]"} ${line.speaker === "user" ? "text-right" : ""}`}
                  >
                    {line.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
