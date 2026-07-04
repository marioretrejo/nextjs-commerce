"use client";

import "@livekit/components-styles";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useTranscriptions,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { use, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";

interface TranscriptLine {
  role: "agent" | "user";
  text: string;
}

// Inner UI — must live inside <LiveKitRoom> to use its hooks.
function CallSurface({
  agentName,
  onEnd,
}: {
  agentName: string;
  onEnd: () => void;
}) {
  const connectionState = useConnectionState();
  const segments = useTranscriptions();
  const transcriptRef = useRef<HTMLDivElement>(null);

  const isActive = connectionState === ConnectionState.Connected;
  const isConnecting = connectionState === ConnectionState.Connecting;

  // Map LiveKit transcription segments to agent/user lines. A segment produced
  // by a local participant is the user; anything else is the agent.
  const transcript: TranscriptLine[] = segments.map((s) => {
    const isLocal = Boolean(
      (s as { participantInfo?: { isLocal?: boolean } }).participantInfo
        ?.isLocal,
    );
    return { role: isLocal ? "user" : "agent", text: s.text };
  });

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript.length]);

  return (
    <>
      <RoomAudioRenderer />
      <div className="flex items-center gap-3 border-b border-[#e0e0e0] p-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0a0a0a] text-xs font-bold text-white">
          {agentName[0]?.toUpperCase() ?? "A"}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#0a0a0a]">{agentName}</p>
          <p className="text-xs text-[#6b6b6b]">
            {isConnecting ? "Connecting…" : isActive ? "Live" : "Connecting…"}
          </p>
        </div>
        {isActive && (
          <span className="ml-auto flex h-2 w-2">
            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
        )}
      </div>

      <div ref={transcriptRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {transcript.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Phone className="mb-3 h-10 w-10 text-[#e0e0e0]" />
            <p className="text-sm text-[#6b6b6b]">Start a voice conversation</p>
          </div>
        )}
        {transcript.map((line, i) => (
          <div
            key={i}
            className={`flex gap-2 ${line.role === "agent" ? "" : "flex-row-reverse"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                line.role === "agent"
                  ? "bg-[#f5f5f5] text-[#0a0a0a]"
                  : "bg-[#0a0a0a] text-white"
              }`}
            >
              {line.text}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 border-t border-[#e0e0e0] p-4">
        <button
          onClick={onEnd}
          className="flex items-center gap-2 rounded-full bg-red-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-red-600"
        >
          <PhoneOff className="h-4 w-4" />
          End Call
        </button>
        <div className="flex items-center gap-1 text-xs text-[#6b6b6b]">
          {isActive ? (
            <Mic className="h-3 w-3" />
          ) : (
            <MicOff className="h-3 w-3" />
          )}
          {isActive ? "Mic active" : "Mic off"}
        </div>
      </div>
    </>
  );
}

export default function WidgetPage({
  params,
}: {
  params: Promise<{ agent_id: string }>;
}) {
  const { agent_id } = use(params);
  const [status, setStatus] = useState<
    "idle" | "connecting" | "active" | "ended"
  >("idle");
  const [agentName, setAgentName] = useState("AI Agent");
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/agents/${agent_id}/widget-config`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("config"))))
      .then((d: { name?: string }) => setAgentName(d.name ?? "AI Agent"))
      .catch(() => setAgentName("AI Agent"));
  }, [agent_id]);

  async function startCall() {
    setStatus("connecting");
    try {
      // LiveKit-native web call: mint a room token (same auth model the widget
      // used before — the endpoint is session-gated).
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent_id }),
      });
      if (!res.ok) {
        setStatus("idle");
        return;
      }
      const data = (await res.json()) as {
        token?: string;
        wsUrl?: string;
        agentName?: string;
      };
      if (!data.token || !data.wsUrl) {
        setStatus("idle");
        return;
      }
      if (data.agentName) setAgentName(data.agentName);
      setToken(data.token);
      setWsUrl(data.wsUrl);
      setStatus("active");
    } catch {
      setStatus("idle");
    }
  }

  function endCall() {
    setToken(null);
    setWsUrl(null);
    setStatus("ended");
  }

  const connected = status === "active" && token && wsUrl;

  return (
    <div className="flex h-screen flex-col bg-white font-sans">
      {connected ? (
        <LiveKitRoom
          token={token}
          serverUrl={wsUrl}
          connect={true}
          audio={true}
          video={false}
          onDisconnected={endCall}
          className="flex flex-1 flex-col"
        >
          <CallSurface agentName={agentName} onEnd={endCall} />
        </LiveKitRoom>
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-[#e0e0e0] p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0a0a0a] text-xs font-bold text-white">
              {agentName[0]?.toUpperCase() ?? "A"}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0a0a0a]">
                {agentName}
              </p>
              <p className="text-xs text-[#6b6b6b]">
                {status === "connecting"
                  ? "Connecting…"
                  : status === "ended"
                    ? "Call ended"
                    : "Click to start"}
              </p>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Phone className="mb-3 h-10 w-10 text-[#e0e0e0]" />
            <p className="text-sm text-[#6b6b6b]">Start a voice conversation</p>
          </div>
          <div className="flex items-center justify-center gap-4 border-t border-[#e0e0e0] p-4">
            <button
              onClick={startCall}
              disabled={status === "connecting"}
              className="flex items-center gap-2 rounded-full bg-[#0a0a0a] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#3a3a3a] disabled:opacity-50"
            >
              <Phone className="h-4 w-4" />
              {status === "connecting"
                ? "Connecting…"
                : status === "ended"
                  ? "Call Again"
                  : "Start Call"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
