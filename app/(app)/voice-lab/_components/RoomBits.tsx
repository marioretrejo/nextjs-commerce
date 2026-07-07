"use client";

import { useEffect } from "react";
import { useConnectionState, useRoomContext } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, PhoneOff, Loader2, Circle } from "lucide-react";

// Inner room component — has access to LiveKit context
export function RoomControls({ onDisconnect }: { onDisconnect: () => void }) {
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

export function ConnectionBadge({ state }: { state: string }) {
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

// Syncs LiveKit connection state to parent without rendering anything
export function RoomStateSync({
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
