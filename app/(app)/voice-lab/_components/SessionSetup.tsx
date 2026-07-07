"use client";

import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlaskConical, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AgentOption, Session } from "./types";
import { RoomControls, ConnectionBadge, RoomStateSync } from "./RoomBits";

export function SessionSetup({
  agents,
  selectedAgentId,
  setSelectedAgentId,
  session,
  connState,
  setConnState,
  starting,
  minutesUsed,
  minutesLimit,
  onStart,
  onEndSession,
}: {
  agents: AgentOption[];
  selectedAgentId: string;
  setSelectedAgentId: (id: string) => void;
  session: Session | null;
  connState: string;
  setConnState: (state: string) => void;
  starting: boolean;
  minutesUsed: number;
  minutesLimit: number;
  onStart: () => void;
  onEndSession: () => void;
}) {
  return (
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
              onClick={onStart}
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
              <LiveKitRoom
                token={session.token}
                serverUrl={session.wsUrl}
                audio={true}
                video={false}
                onConnected={() => setConnState(ConnectionState.Connected)}
                onDisconnected={onEndSession}
                onError={(err) => {
                  toast.error(`Connection error: ${err.message}`);
                  onEndSession();
                }}
              >
                <RoomAudioRenderer />
                <RoomControls onDisconnect={onEndSession} />
                <RoomStateSync onStateChange={setConnState} />
              </LiveKitRoom>
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
  );
}
