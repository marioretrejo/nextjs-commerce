/**
 * Emergency Deterministic Responses — Fase 11
 *
 * Pure functions for handling call situations where the LLM is unavailable.
 * No LLM calls — all logic uses regex/heuristics and is guaranteed to be fast.
 *
 * Used as a last resort when both Groq and OpenAI are down or timing out.
 */

export type EmergencyReason =
  | "llm_unavailable"
  | "llm_timeout"
  | "both_llm_failed"
  | "confusion"
  | "transfer"
  | "general";

export interface EmergencyIntentResult {
  shouldEndCall: boolean;
  shouldTransfer: boolean;
  shouldOptOut: boolean;
  detectedIntent: "transfer" | "dnc" | "end_call" | "confusion" | "none";
}

const FILLER_POOL: Readonly<Record<EmergencyReason, string>> = {
  llm_unavailable: "Dame un momento, por favor.",
  llm_timeout: "Permíteme verificar eso.",
  both_llm_failed: "Voy a transferirte con un asesor. Un momento.",
  confusion: "¿Podrías repetir eso? No te escuché bien.",
  transfer: "Voy a conectarte con un asesor. Un momento.",
  general: "Dame un momento, por favor.",
};

/**
 * Returns a short deterministic filler phrase appropriate for the given reason.
 * Never calls the LLM — safe to use when the LLM pipeline is down.
 */
export function getEmergencyLLMResponse(
  reason: EmergencyReason,
  _context?: string,
): string {
  return FILLER_POOL[reason] ?? FILLER_POOL.general;
}

/**
 * Classifies a transcript fragment using regex heuristics.
 * Returns intent signals for the emergency handler to act on.
 */
export function classifyEmergencyIntent(text: string): EmergencyIntentResult {
  const t = text.toLowerCase();

  // DNC / opt-out signals
  const shouldOptOut =
    /no\s+me\s+llam|deja\s+de\s+llamar|quita\s+(me\s+)?de\s+(tu\s+)?lista|remove\s+(me\s+)?from\s+(your\s+)?list|do\s+not\s+call|don'?t\s+(ever\s+)?call\s+(me|again)|stop\s+calling|quit\s+calling|no\s+llames\s+m[aá]s/i.test(
      t,
    );

  // Transfer / human-agent request
  const shouldTransfer =
    /quiero\s+(hablar\s+con|un)\s*(humano|persona|asesor|agente|representante)|p[oó]name\s+con|con[eé]ctame\s+con|transfer|speak\s+to\s+(a\s+)?(human|agent|person|representative)|talk\s+to\s+(a\s+)?(human|someone|agent)|hablar\s+con\s+alguien/i.test(
      t,
    );

  // Aggressive / end-call signals
  const isAggressive =
    /fuck\s+off|piss\s+off|go\s+to\s+hell|jódete|vete\s+al\s+diablo|no\s+me\s+molestes/i.test(
      t,
    );

  // Disinterest / goodbye
  const isGoodbye =
    /adi[oó]s|goodbye|bye|hasta\s+luego|no\s+gracias|no\s+me\s+interesa|not\s+interested|no\s+quiero/i.test(
      t,
    );

  const shouldEndCall = shouldOptOut || isAggressive || isGoodbye;

  let detectedIntent: EmergencyIntentResult["detectedIntent"] = "none";
  if (shouldTransfer) detectedIntent = "transfer";
  else if (shouldOptOut) detectedIntent = "dnc";
  else if (isGoodbye || isAggressive) detectedIntent = "end_call";

  return { shouldEndCall, shouldTransfer, shouldOptOut, detectedIntent };
}

/** Convenience: return true if rules say the call should end. */
export function shouldEndCallByRules(text: string): boolean {
  return classifyEmergencyIntent(text).shouldEndCall;
}

/** Convenience: return true if rules say the caller wants a human transfer. */
export function shouldTransferByRules(text: string): boolean {
  return classifyEmergencyIntent(text).shouldTransfer;
}

/** Convenience: return true if caller is opting out (DNC). */
export function shouldOptOutByRules(text: string): boolean {
  return classifyEmergencyIntent(text).shouldOptOut;
}
