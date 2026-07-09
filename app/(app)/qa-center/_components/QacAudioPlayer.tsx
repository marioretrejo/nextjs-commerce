"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDuration } from "./format";

function closeEnough(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return true;
  return Math.abs(a - b) <= 2;
}

export function QacAudioPlayer({
  src,
  downloadHref,
  cdrDurationSeconds,
  label,
}: {
  src: string;
  downloadHref: string;
  cdrDurationSeconds: number | null;
  label?: string | null;
}) {
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const mismatch = !closeEnough(audioDuration, cdrDurationSeconds);
  const displayDuration = audioDuration ?? cdrDurationSeconds;
  const hint = useMemo(() => {
    if (!mismatch) return null;
    return `Audio ${formatDuration(audioDuration)} / CDR ${formatDuration(cdrDurationSeconds)}`;
  }, [audioDuration, cdrDurationSeconds, mismatch]);

  return (
    <div className="mt-4 space-y-3">
      <audio
        controls
        className="w-full"
        src={src}
        onLoadedMetadata={(event) => {
          const duration = event.currentTarget.duration;
          setAudioDuration(
            Number.isFinite(duration) ? Math.round(duration) : null,
          );
        }}
      >
        <track kind="captions" />
      </audio>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={downloadHref}
          className="inline-flex items-center gap-2 rounded-md border border-[#d8d8d2] px-3 py-2 text-sm font-medium text-[#181816]"
        >
          <Download className="h-4 w-4" />
          Download recording
        </a>
        <span className="text-xs font-medium text-[#77756d]">
          {formatDuration(displayDuration)}
        </span>
        {hint && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
            {hint}
          </span>
        )}
        {label && (
          <span className="break-all text-xs text-[#77756d]">{label}</span>
        )}
      </div>
    </div>
  );
}
