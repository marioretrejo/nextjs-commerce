"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { ConnectionState } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FlaskConical,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Loader2,
  Circle,
} from "lucide-react";
import { toast } from "sonner";

interface AgentOption {
  id: string;
  name: string;
  voice_id: string | null;
  first_message: string | null;
}

interface LabEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  call_id: string | null;
}

interface VoiceLabClientProps {
  agents: AgentOption[];
  workspaceId: string;
  isSuspended: boolean;
  minutesUsed: number;
  minutesLimit: number;
}

// Color map for event types
function eventColor(type: string): string {
  if (
    type === "call.initiated" ||
    type === "livekit.room_joined" ||
    type === "llm.provider_selected" ||
    type === "tts.provider_selected" ||
    type === "billing.preflight_passed"
  )
    return "text-emerald-600";
  if (type === "call.answered" || type === "call.ended") return "text-sky-600";
  if (type === "assistant.speech_started") return "text-violet-600";
  if (type === "assistant.speech_ended") return "text-violet-400";
  if (
    type.includes("phase3") ||
    type.includes(".down") ||
    type.includes("failed") ||
    type.includes("circuit_breaker")
  )
    return "text-red-600";
  if (
    type.includes("phase1") ||
    type.includes("phase2") ||
    type.includes("degraded")
  )
    return "text-amber-600";
  return "text-[#666]";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// Inner room component — has access to LiveKit context
function RoomControls({ onDisconnect }: { onDisconnect: () => void }) {
  const connectionState = useConnectionState();
  const room = useRoomContext();

  const isMuted = room.localParticipant?.isMicrophoneEnabled === false;

  function toggleMic() {
    room.localParticipant?.setMicrophoneEnabled(isMuted);
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={toggleMic} className="gap-2">
        {isMuted ? (
          <MicOff className="h-4 w-4 text-red-500" />
        ) : (
          <Mic className="h-4 w-4 text-emerald-500" />
        )}
        {isMuted ? "Unmute" : "Mute"}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={onDisconnect}
        className="gap-2"
        disabled={connectionState === ConnectionState.Disconnected}
      >
        <PhoneOff className="h-4 w-4" />
        End Session
      </Button>
    </div>
  );
}

function ConnectionBadge({ state }: { state: string }) {
  if (state === ConnectionState.Connected)
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
        <Circle className="h-2 w-2 fill-emerald-500 mr-1.5" />
        Connected
      </Badge>
    );
  if (state === ConnectionState.Connecting)
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200">
        <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
        Connecting…
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-[#999]">
      <Circle className="h-2 w-2 mr-1.5" />
      Idle
    </Badge>
  );
}

export function VoiceLabClient({
  agents,
  isSuspended,
  minutesUsed,
  minutesLimit,
}: VoiceLabClientProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    agents[0]?.id ?? "",
  );
  const [session, setSession] = useState<{
    token: string;
    wsUrl: string;
    roomName: string;
    agentName: string;
  } | null>(null);
  const [starting, setStarting] = useState(false);
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [connState, setConnState] = useState<string>(
    ConnectionState.Disconnected,
  );
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (roomName: string) => {
      stopPolling();
      const poll = async () => {
        try {
          const res = await fetch(
            `/api/voice-lab/events?room=${encodeURIComponent(roomName)}`,
          );
          if (!res.ok) return;
          const { events: newEvents } = (await res.json()) as {
            events: LabEvent[];
          };
          setEvents(newEvents ?? []);
        } catch {
          // non-fatal
        }
      };
      void poll();
      pollRef.current = setInterval(() => void poll(), 2_000);
    },
    [stopPolling],
  );

  // Auto-scroll events feed
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  async function startSession() {
    if (!selectedAgentId) {
      toast.error("Select an agent first");
      return;
    }
    if (isSuspended) {
      toast.error("Account suspended — contact support");
      return;
    }
    if (minutesUsed >= minutesLimit) {
      toast.error("Minute limit reached — upgrade your plan");
      return;
    }

    setStarting(true);
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: selectedAgentId }),
      });
      if (!res.ok) {
        const { error } = (await res.json()) as { error?: string };
        throw new Error(error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        token: string;
        wsUrl: string;
        roomName: string;
        agentName: string;
      };
      setEvents([]);
      setSession(data);
      startPolling(data.roomName);
      toast.success(`Session started — agent: ${data.agentName}`);
    } catch (err) {
      toast.error(`Failed to start session: ${String(err)}`);
    } finally {
      setStarting(false);
    }
  }

  function endSession() {
    stopPolling();
    setSession(null);
    setConnState(ConnectionState.Disconnected);
    toast.info("Session ended");
  }

  const isConnected = connState === ConnectionState.Connected;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left panel: controls */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-violet-500" />
              Session Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#666]">Agent</label>
              <Select
                value={selectedAgentId}
                onValueChange={setSelectedAgentId}
                disabled={!!session}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select agent…" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {agents.length === 0 && (
                <p className="text-xs text-red-500">
                  No active agents found. Create one in Agents.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#666]">
                Connection
              </label>
              <div className="flex items-center gap-2">
                <ConnectionBadge state={connState} />
              </div>
            </div>

            {!session ? (
              <Button
                className="w-full gap-2"
                size="sm"
                onClick={() => void startSession()}
                disabled={starting || !selectedAgentId || agents.length === 0}
              >
                {starting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
                {starting ? "Starting…" : "Start Test Session"}
              </Button>
            ) : (
              <div className="space-y-2">
                {session && (
                  <LiveKitRoom
                    token={session.token}
                    serverUrl={session.wsUrl}
                    audio={true}
                    video={false}
                    onConnected={() => setConnState(ConnectionState.Connected)}
                    onDisconnected={() => endSession()}
                    onError={(err) => {
                      toast.error(`Connection error: ${err.message}`);
                      endSession();
                    }}
                  >
                    <RoomAudioRenderer />
                    <RoomControls onDisconnect={endSession} />
                    <RoomStateSync onStateChange={setConnState} />
                  </LiveKitRoom>
                )}
              </div>
            )}

            {minutesLimit > 0 && (
              <div className="pt-1">
                <div className="flex justify-between text-[10px] text-[#999] mb-1">
                  <span>Minutes used</span>
                  <span>
                    {minutesUsed}/{minutesLimit}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-[#f0f0f0] overflow-hidden">
                  <div
                    className="h-full bg-violet-400 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (minutesUsed / minutesLimit) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {session && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-[#666]">
                Room
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] font-mono text-[#888] break-all">
                {session.roomName}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right panel: event feed */}
      <div className="lg:col-span-2">
        <Card className="h-[600px] flex flex-col">
          <CardHeader className="pb-2 flex-none">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Live Event Stream</span>
              {events.length > 0 && (
                <span className="text-xs font-normal text-[#999]">
                  {events.length} events
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4">
            {events.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-[#ccc] gap-3">
                <FlaskConical className="h-10 w-10" />
                <div>
                  <p className="text-sm font-medium">No events yet</p>
                  <p className="text-xs mt-1">
                    {session
                      ? "Waiting for worker to join…"
                      : "Start a session to see live events here"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1 font-mono text-[11px]">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start gap-2 py-0.5 hover:bg-[#fafafa] rounded px-1"
                  >
                    <span className="text-[#ccc] flex-none w-16 shrink-0 pt-px">
                      {formatTime(ev.created_at)}
                    </span>
                    <span
                      className={`font-semibold flex-none ${eventColor(ev.event_type)}`}
                    >
                      {ev.event_type}
                    </span>
                    {Object.keys(ev.payload).length > 0 && (
                      <span className="text-[#bbb] truncate">
                        {JSON.stringify(ev.payload)
                          .replace(/^{|}$/g, "")
                          .replace(/"([^"]+)":/g, "$1:")
                          .slice(0, 80)}
                      </span>
                    )}
                  </div>
                ))}
                <div ref={eventsEndRef} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Validation checklist — shown when session active */}
        {(session || events.length > 0) && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              {
                label: "Worker joined",
                check: events.some(
                  (e) => e.event_type === "livekit.room_joined",
                ),
              },
              {
                label: "LLM selected",
                check: events.some(
                  (e) => e.event_type === "llm.provider_selected",
                ),
              },
              {
                label: "TTS selected",
                check: events.some(
                  (e) => e.event_type === "tts.provider_selected",
                ),
              },
              {
                label: "User spoke",
                check: events.some((e) => e.event_type === "call.answered"),
              },
              {
                label: "Agent spoke",
                check: events.some(
                  (e) => e.event_type === "assistant.speech_started",
                ),
              },
              {
                label: "Session ended clean",
                check: events.some((e) => e.event_type === "call.ended"),
              },
            ].map(({ label, check }) => (
              <div
                key={label}
                className={`flex items-center gap-2 text-xs rounded-md px-3 py-2 border ${
                  check
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-[#fafafa] border-[#eee] text-[#999]"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full flex-none ${check ? "bg-emerald-500" : "bg-[#ddd]"}`}
                />
                {label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Syncs LiveKit connection state to parent without rendering anything
function RoomStateSync({
  onStateChange,
}: {
  onStateChange: (state: string) => void;
}) {
  const connState = useConnectionState();
  useEffect(() => {
    onStateChange(connState);
  }, [connState, onStateChange]);
  return null;
}
