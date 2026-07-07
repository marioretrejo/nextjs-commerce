// Color map for event types
export function eventColor(type: string): string {
  if (
    type === "call.initiated" ||
    type === "livekit.room_joined" ||
    type === "llm.provider_selected" ||
    type === "tts.provider_selected" ||
    type === "billing.preflight_passed"
  )
    return "text-emerald-600";
  if (type === "call.answered" || type === "call.ended") return "text-sky-600";
  if (type === "assistant.speech_started") return "text-violet-600";
  if (type === "assistant.speech_ended") return "text-violet-400";
  if (
    type.includes("phase3") ||
    type.includes(".down") ||
    type.includes("failed") ||
    type.includes("circuit_breaker")
  )
    return "text-red-600";
  if (
    type.includes("phase1") ||
    type.includes("phase2") ||
    type.includes("degraded")
  )
    return "text-amber-600";
  return "text-[#666]";
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
