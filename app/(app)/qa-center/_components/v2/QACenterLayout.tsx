"use client";

import { useState, useEffect } from "react";
import { CallsList } from "./CallsList";
import { CallPlayer } from "./CallPlayer";
import { ScoreCard } from "./ScoreCard";
import type { Call } from "@/lib/supabase/types";

interface QACenterLayoutProps {
  selectedCallId: string | null;
  onSelectCall: (callId: string) => void;
}

export function QACenterLayout({
  selectedCallId,
  onSelectCall,
}: QACenterLayoutProps) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCalls();
  }, []);

  useEffect(() => {
    if (selectedCallId && calls.length > 0) {
      const call = calls.find((c) => c.id === selectedCallId);
      setSelectedCall(call || null);
    }
  }, [selectedCallId, calls]);

  async function fetchCalls() {
    try {
      const res = await fetch("/api/calls?limit=50&sort=created_at:desc");
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls || []);
        if (data.calls?.length > 0 && !selectedCallId) {
          onSelectCall(data.calls[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch calls:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">QA Center</h1>
            <p className="text-sm text-gray-600 mt-1">
              Review and analyze customer interactions
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-black">{calls.length}</span>{" "}
              calls
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 3 Panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Calls List */}
        <div className="w-80 border-r border-gray-200 overflow-auto">
          <CallsList
            calls={calls}
            selectedCall={selectedCall}
            onSelectCall={(call) => {
              setSelectedCall(call);
              onSelectCall(call.id);
            }}
            loading={loading}
            onRefresh={fetchCalls}
          />
        </div>

        {/* Center Panel: Call Player & Transcript */}
        <div className="flex-1 overflow-auto border-r border-gray-200">
          <CallPlayer call={selectedCall} loading={loading} />
        </div>

        {/* Right Panel: Score Card */}
        <div className="w-96 overflow-auto bg-gray-50">
          <ScoreCard call={selectedCall} loading={loading} />
        </div>
      </div>
    </div>
  );
}
