"use client";

import { useState } from "react";
import { Play, Pause, Search, Download } from "lucide-react";
import type { Call } from "@/lib/supabase/types";

interface CallPlayerProps {
  call: Call | null;
  loading: boolean;
}

export function CallPlayer({ call, loading }: CallPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-20 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl text-gray-200 mb-4">🎙️</div>
          <p className="text-gray-500 font-medium">No call selected</p>
          <p className="text-gray-400 text-sm">
            Select a call from the list to start reviewing
          </p>
        </div>
      </div>
    );
  }

  const duration = call.duration_seconds || 0;
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Call Info Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-black mb-1">
            {call.contact_name || "Unknown Client"}
          </h2>
          <p className="text-sm text-gray-600">
            Agent: {call.external_agent_name || "—"} · Phone:{" "}
            {call.contact_phone || "—"}
          </p>
        </div>

        {/* Audio Player */}
        <div className="space-y-3">
          {/* Player Controls */}
          <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-lg">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 hover:bg-gray-200 rounded-full transition"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 text-black" />
              ) : (
                <Play className="h-5 w-5 text-black" />
              )}
            </button>

            {/* Timeline */}
            <div className="flex-1 space-y-1">
              <div className="bg-gray-300 h-1 rounded-full cursor-pointer hover:bg-gray-400 transition">
                {/* Waveform would go here */}
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>{String(Math.floor(currentTime / 60)).padStart(2, "0")}:{String(currentTime % 60).padStart(2, "0")}</span>
                <span>{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</span>
              </div>
            </div>

            {/* Speed */}
            <select className="text-sm border border-gray-300 rounded px-2 py-1 bg-white text-black">
              <option>1x</option>
              <option>1.25x</option>
              <option>1.5x</option>
              <option>2x</option>
            </select>

            {/* Download */}
            {call.recording_url && (
              <button
                onClick={() => window.open(call.recording_url, "_blank")}
                className="p-2 hover:bg-gray-200 rounded-full transition"
                title="Download recording"
              >
                <Download className="h-5 w-5 text-gray-600" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Search Transcript */}
        <div className="sticky top-0 bg-white pb-3 border-b border-gray-200 -mx-6 px-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search in transcript..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
        </div>

        {/* Transcript Content */}
        {call.transcript ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 leading-relaxed">
              {call.transcript}
            </p>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <p className="text-sm">No transcript available</p>
            <p className="text-xs text-gray-400 mt-1">
              Transcript will appear once analysis is complete
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
