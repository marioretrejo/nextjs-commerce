/** Label/format helpers for the infrastructure page. */

export function providerLabel(p: string): string {
  const labels: Record<string, string> = {
    groq: "Groq (LLM)",
    openai: "OpenAI",
    cartesia: "Cartesia (TTS)",
    deepgram: "Deepgram (STT)",
    livekit: "LiveKit",
    twilio: "Twilio",
    supabase: "Supabase",
    webhook: "Webhooks",
    post_call_jobs: "Post-Call Jobs",
    cron: "Cron Jobs",
  };
  return labels[p] ?? p;
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

export function eventLabel(et: string): string {
  const labels: Record<string, string> = {
    "llm.provider_degraded": "LLM degraded",
    "llm.provider_down": "LLM down",
    "llm.fallback_selected": "LLM fallback triggered",
    "llm.fallback_failed": "LLM fallback failed",
    "llm.runtime_fallback_unavailable": "LLM no fallback available",
    "tts.provider_degraded": "TTS degraded",
    "tts.provider_down": "TTS down",
    "tts.fallback_selected": "TTS fallback triggered",
    "tts.fallback_failed": "TTS fallback failed",
    "tts.fallback_unavailable": "TTS no fallback available",
    "billing.circuit_breaker_triggered": "Billing circuit breaker opened",
    "webhook.failed": "Webhook delivery failed",
    "post_call_jobs.dead_letter": "Job moved to dead-letter",
    "post_call_jobs.failed": "Job failed",
  };
  return labels[et] ?? et;
}
