"use client";

import { useState, useRef } from "react";
import { Download, Pause, Play, Volume2, VolumeX } from "lucide-react";

export function AudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      void el.play();
    }
    setPlaying(!playing);
  }

  function onTimeUpdate() {
    setCurrent(audioRef.current?.currentTime ?? 0);
  }

  function onLoadedMetadata() {
    setDuration(audioRef.current?.duration ?? 0);
    setLoading(false);
  }

  function onEnded() {
    setPlaying(false);
    setCurrent(0);
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const t = Number(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrent(t);
  }

  function toggleMute() {
    if (audioRef.current) audioRef.current.muted = !muted;
    setMuted((m) => !m);
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${sec}`;
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="rounded-xl border border-[#efefef] bg-[#fafafa] px-4 py-3">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        preload="metadata"
      />
      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <button
          onClick={toggle}
          disabled={loading}
          className="h-8 w-8 rounded-full bg-[#111] flex items-center justify-center shrink-0 hover:bg-[#333] transition-colors disabled:opacity-40"
        >
          {playing ? (
            <Pause className="h-3.5 w-3.5 text-white" />
          ) : (
            <Play className="h-3.5 w-3.5 text-white ml-0.5" />
          )}
        </button>

        {/* Time / Seek */}
        <div className="flex-1 space-y-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={current}
            onChange={seek}
            className="w-full h-1 appearance-none bg-[#e0e0e0] rounded-full cursor-pointer accent-[#111]"
            style={{
              background: `linear-gradient(to right, #111 ${pct}%, #e0e0e0 ${pct}%)`,
            }}
          />
          <div className="flex justify-between text-[10px] text-[#9b9b9b]">
            <span>{fmt(current)}</span>
            <span>{loading ? "…" : fmt(duration)}</span>
          </div>
        </div>

        {/* Mute */}
        <button
          onClick={toggleMute}
          className="text-[#9b9b9b] hover:text-[#111] transition-colors"
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>

        {/* Download */}
        <a
          href={url}
          download
          className="flex items-center gap-1 text-[10px] font-medium text-[#9b9b9b] hover:text-[#111] transition-colors border border-[#e0e0e0] rounded-lg px-2 py-1 hover:border-[#111]"
        >
          <Download className="h-3 w-3" />
          Download
        </a>
      </div>
    </div>
  );
}

// ─── Circular Score Gauge ─────────────────────────────────────────────────────
