import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  pending_cdr: "border-slate-200 bg-slate-50 text-slate-700",
  pending_audio: "border-amber-200 bg-amber-50 text-amber-800",
  audio_ready: "border-blue-200 bg-blue-50 text-blue-800",
  transcribing: "border-cyan-200 bg-cyan-50 text-cyan-800",
  transcribed: "border-sky-200 bg-sky-50 text-sky-800",
  analyzing: "border-indigo-200 bg-indigo-50 text-indigo-800",
  analyzed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  not_evaluable: "border-zinc-200 bg-zinc-50 text-zinc-700",
  failed_audio: "border-red-200 bg-red-50 text-red-700",
  failed_transcription: "border-red-200 bg-red-50 text-red-700",
  failed_analysis: "border-red-200 bg-red-50 text-red-700",
  manual_review_required: "border-orange-200 bg-orange-50 text-orange-800",
  pending_review: "border-slate-200 bg-white text-slate-700",
  in_review: "border-blue-200 bg-blue-50 text-blue-800",
  reviewed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  approved: "border-green-200 bg-green-50 text-green-800",
  disputed: "border-rose-200 bg-rose-50 text-rose-800",
};

export function StatusBadge({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const label = value?.replace(/_/g, " ") ?? "unknown";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        STATUS_STYLES[value ?? ""] ??
          "border-slate-200 bg-slate-50 text-slate-700",
        className,
      )}
    >
      {label}
    </span>
  );
}
