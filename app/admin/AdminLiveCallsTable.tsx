'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Radio, RefreshCw } from 'lucide-react';

interface LiveRoom {
  name: string;
  numParticipants: number;
  creationTime: string;
  metadata: {
    agent_name?: string;
    workspace_id?: string;
  };
}

interface LiveRoomsResponse {
  rooms: LiveRoom[];
}

function elapsed(creationTime: string): string {
  const secs = Math.floor((Date.now() - Number(creationTime) * 1000) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

export function AdminLiveCallsTable() {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/live-rooms');
      if (!res.ok) return;
      const data = await res.json() as LiveRoomsResponse;
      setRooms(data.rooms ?? []);
      setLastRefresh(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <Card className="bg-white border-[#e5e5e5]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="w-4 h-4 text-green-500" />
            Live Calls
            {rooms.length > 0 && (
              <span className="flex h-2 w-2 relative ml-1">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-[#a0a0a0]">
            {loading
              ? <RefreshCw className="h-3 w-3 animate-spin" />
              : <span>Updated {lastRefresh.toLocaleTimeString()}</span>
            }
            <button
              onClick={refresh}
              className="rounded p-1 hover:bg-[#f5f5f5] transition-colors"
              title="Refresh now"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[#6b6b6b]" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rooms.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#a0a0a0]">
            {loading ? 'Loading…' : 'No active calls right now'}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-5 py-3 border-t border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
              <span>Room / Agent</span>
              <span>Participants</span>
              <span>Duration</span>
              <span>Workspace</span>
            </div>
            <div className="divide-y divide-[#e0e0e0]">
              {rooms.map((room) => (
                <div
                  key={room.name}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-5 py-3 text-sm items-center hover:bg-[#f9f9f9]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[#0a0a0a] truncate">
                      {room.metadata?.agent_name ?? 'Agent'}
                    </p>
                    <p className="text-xs text-[#a0a0a0] truncate font-mono">{room.name}</p>
                  </div>
                  <div>
                    <Badge variant="secondary" className="text-xs">
                      {room.numParticipants} live
                    </Badge>
                  </div>
                  <span className="text-[#6b6b6b] text-xs font-mono">
                    {elapsed(room.creationTime)}
                  </span>
                  <span className="text-[#6b6b6b] text-xs font-mono truncate">
                    {room.metadata?.workspace_id?.slice(0, 8) ?? '—'}…
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
