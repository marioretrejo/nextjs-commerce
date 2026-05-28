'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type WaveSurferType from 'wavesurfer.js';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, VolumeX, SkipBack } from 'lucide-react';

interface Props {
  url:        string;
  transcript: string | null;
  duration:   number; // seconds, from DB record
}

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function WaveformPlayer({ url, transcript, duration: dbDuration }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const wsRef         = useRef<WaveSurferType | null>(null);
  const [ready,    setReady]    = useState(false);
  const [playing,  setPlaying]  = useState(false);
  const [muted,    setMuted]    = useState(false);
  const [current,  setCurrent]  = useState(0);
  const [duration, setDuration] = useState(dbDuration);
  const [error,    setError]    = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const lines = (transcript ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const activeLine = duration > 0 && lines.length > 0
    ? Math.min(Math.floor((current / duration) * lines.length), lines.length - 1)
    : -1;

  // Auto-scroll transcript to active line
  useEffect(() => {
    if (activeLine < 0 || !transcriptRef.current) return;
    const el = transcriptRef.current.querySelectorAll('[data-line]')[activeLine] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeLine]);

  useEffect(() => {
    let ws: WaveSurferType | null = null;
    let destroyed = false;

    async function init() {
      const { default: WaveSurfer } = await import('wavesurfer.js');
      if (destroyed || !containerRef.current) return;

      ws = WaveSurfer.create({
        container:     containerRef.current,
        waveColor:     '#d4d4d4',
        progressColor: '#0a0a0a',
        cursorColor:   '#0a0a0a',
        barWidth:      3,
        barGap:        2,
        barRadius:     4,
        height:        80,
        normalize:     true,
        url,
      });

      wsRef.current = ws;

      ws.on('ready', () => {
        if (destroyed) return;
        setDuration(ws!.getDuration());
        setReady(true);
      });
      ws.on('timeupdate',  (t: number) => { if (!destroyed) setCurrent(t); });
      ws.on('play',        ()  => { if (!destroyed) setPlaying(true); });
      ws.on('pause',       ()  => { if (!destroyed) setPlaying(false); });
      ws.on('finish',      ()  => { if (!destroyed) setPlaying(false); });
      ws.on('error',       ()  => { if (!destroyed) setError('Could not load audio — the recording URL may have expired.'); });
    }

    init().catch(() => setError('Failed to initialize audio player.'));

    return () => {
      destroyed = true;
      ws?.destroy();
      wsRef.current = null;
    };
  }, [url]);

  const toggle = useCallback(() => wsRef.current?.playPause(), []);
  const restart = useCallback(() => { wsRef.current?.seekTo(0); wsRef.current?.play(); }, []);
  const toggleMute = useCallback(() => {
    if (!wsRef.current) return;
    const next = !muted;
    wsRef.current.setMuted(next);
    setMuted(next);
  }, [muted]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Waveform + controls */}
      <div className="rounded-lg border border-[#e0e0e0] bg-[#0a0a0a] p-4 space-y-3">
        {/* WaveSurfer canvas target */}
        <div ref={containerRef} className={ready ? '' : 'opacity-0 h-20'} />

        {!ready && (
          <div className="h-20 flex items-center justify-center">
            <div className="flex gap-1">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-[#3a3a3a] animate-pulse"
                  style={{
                    height:           `${20 + Math.sin(i * 0.8) * 15}px`,
                    animationDelay:   `${i * 60}ms`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-white hover:bg-white/10"
              onClick={restart}
              disabled={!ready}
              title="Restart"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="h-10 w-10 bg-white text-[#0a0a0a] hover:bg-white/90 rounded-full"
              onClick={toggle}
              disabled={!ready}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-white hover:bg-white/10"
              onClick={toggleMute}
              disabled={!ready}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>

          <div className="font-mono text-sm text-white/70 tabular-nums">
            {fmt(current)} <span className="text-white/30">/</span> {fmt(duration)}
          </div>
        </div>

        {/* Progress bar (clickable) */}
        <div
          className="h-1 w-full rounded-full bg-white/10 cursor-pointer"
          onClick={(e) => {
            if (!wsRef.current || !ready) return;
            const rect = e.currentTarget.getBoundingClientRect();
            wsRef.current.seekTo((e.clientX - rect.left) / rect.width);
          }}
        >
          <div
            className="h-full rounded-full bg-white/60 transition-all"
            style={{ width: duration > 0 ? `${(current / duration) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Transcript — synchronized */}
      {lines.length > 0 && (
        <div className="border border-t-0 border-[#e0e0e0] rounded-b-lg bg-white">
          <div className="px-4 py-2.5 border-b border-[#e0e0e0] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-wide">Transcript</span>
            {playing && (
              <span className="text-[10px] text-[#6b6b6b] flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                </span>
                Synced to playback
              </span>
            )}
          </div>
          <div
            ref={transcriptRef}
            className="max-h-[480px] overflow-y-auto divide-y divide-[#f5f5f5]"
          >
            {lines.map((line, i) => {
              const isAgent  = /^(agent|ai|assistant)\s*:/i.test(line);
              const isActive = i === activeLine;
              const text     = line.replace(/^(agent|ai|assistant|user|caller|contact)\s*:/i, '').trim();
              const speaker  = isAgent ? 'Agent' : 'Contact';

              return (
                <div
                  key={i}
                  data-line={i}
                  className={`flex gap-3 px-4 py-3 transition-colors ${
                    isActive ? 'bg-amber-50' : 'hover:bg-[#fafafa]'
                  } ${isAgent ? '' : 'flex-row-reverse'}`}
                >
                  {/* Avatar dot */}
                  <div className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5
                    ${isAgent ? 'bg-[#0a0a0a] text-white' : 'bg-[#e0e0e0] text-[#6b6b6b]'}`}>
                    {speaker[0]}
                  </div>
                  <div className={`max-w-[80%] ${isAgent ? '' : 'text-right'}`}>
                    <p className={`text-[10px] font-semibold mb-0.5 ${isActive ? 'text-amber-600' : 'text-[#6b6b6b]'}`}>
                      {speaker}
                      {isActive && playing && <span className="ml-1.5 text-amber-500">▶</span>}
                    </p>
                    <p className={`text-sm leading-relaxed ${isActive ? 'text-[#0a0a0a] font-medium' : 'text-[#4a4a4a]'}`}>
                      {text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
