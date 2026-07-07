"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import "@livekit/components-styles";
import { ConnectionState } from "livekit-client";
import { toast } from "sonner";
import type {
  LabEvent,
  Session,
  VoiceLabClientProps,
} from "./_components/types";
import { SessionSetup } from "./_components/SessionSetup";
import { EventStream } from "./_components/EventStream";

export function VoiceLabClient({
  agents,
  isSuspended,
  minutesUsed,
  minutesLimit,
}: VoiceLabClientProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    agents[0]?.id ?? "",
  );
  const [session, setSession] = useState<Session | null>(null);
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
      const data = (await res.json()) as Session;
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SessionSetup
        agents={agents}
        selectedAgentId={selectedAgentId}
        setSelectedAgentId={setSelectedAgentId}
        session={session}
        connState={connState}
        setConnState={setConnState}
        starting={starting}
        minutesUsed={minutesUsed}
        minutesLimit={minutesLimit}
        onStart={() => void startSession()}
        onEndSession={endSession}
      />
      <EventStream
        events={events}
        session={session}
        eventsEndRef={eventsEndRef}
      />
    </div>
  );
}
