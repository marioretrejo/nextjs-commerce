/**
 * LLM Provider Router — Fase 11 LLM Fallback
 *
 * Tries to create a Groq LLM instance as the primary provider (using the
 * OpenAI-compatible API). If Groq construction fails or the API key is missing,
 * falls back to native OpenAI if OPENAI_API_KEY is available.
 *
 * Both providers use the same LLM class from @livekit/agents-plugin-openai —
 * Groq is accessed via a baseURL override pointing to its OpenAI-compatible
 * endpoint. This means no extra SDK dependency is required.
 *
 * NOTE: Mid-session LLM swap is architecturally not possible with LiveKit
 * Agents SDK ^1.4.4 — voice.AgentSession.llm is immutable after construction.
 * This fallback applies only at session construction time. Runtime LLM
 * degradation is detected by the thinking watchdog but cannot auto-swap the
 * provider. See docs/voice-runtime-limitations.md for details.
 *
 * Injectable factory functions (_groqFactory, _openaiFactory) allow unit tests
 * to stub providers without real API connections.
 */
import { LLM } from "@livekit/agents-plugin-openai";

export type LLMProviderName = "groq" | "openai" | "emergency";

export type LLMProviderState = "healthy" | "degraded" | "down";

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const DEFAULT_GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export interface LLMRouterConfig {
  groqApiKey?: string;
  openaiApiKey?: string;
  /** Groq model to use (default: llama-4-scout-17b) */
  groqModel?: string;
  /** OpenAI model used when falling back (default: gpt-4o-mini) */
  openaiModel?: string;
  /** Injected factory for tests — avoids real SDK construction */
  _groqFactory?: (opts: unknown) => LLM;
  /** Injected factory for tests */
  _openaiFactory?: (opts: unknown) => LLM;
}

export interface LLMRouterResult {
  llm: LLM;
  providerName: LLMProviderName;
  fallbackUsed: boolean;
  reason?: string;
}

/**
 * Emergency filler phrases used when the thinking watchdog fires and no LLM
 * response has arrived. These are deterministic — no LLM call is made.
 */
export const EMERGENCY_LLM_FILLERS: Readonly<Record<string, string>> = {
  llm_slow: "Dame un momento, por favor.",
  llm_timeout: "Permíteme verificar eso.",
  llm_unavailable: "Un momento, por favor.",
  transfer: "Voy a transferirte con un asesor. Un momento.",
};

/**
 * Attempts to construct an LLM provider, falling back from Groq to OpenAI on
 * any constructor-level failure or missing API key.
 *
 * Returns null only when BOTH providers fail — the caller must abort the session.
 */
export function createLLMProvider(
  config: LLMRouterConfig,
): LLMRouterResult | null {
  const groqFactory =
    config._groqFactory ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((opts: unknown) => new LLM(opts as any));
  const openaiFactory =
    config._openaiFactory ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((opts: unknown) => new LLM(opts as any));

  // ── Primary: Groq (OpenAI-compatible, low-latency) ─────────────────────────
  if (config.groqApiKey) {
    try {
      const llm = groqFactory({
        model: config.groqModel ?? DEFAULT_GROQ_MODEL,
        apiKey: config.groqApiKey,
        baseURL: GROQ_BASE_URL,
      });
      return { llm, providerName: "groq", fallbackUsed: false };
    } catch (err) {
      // Groq constructor threw — fall through to OpenAI
      const reason = `groq_constructor_failed: ${String(err).slice(0, 120)}`;
      return _tryOpenAI(config, openaiFactory, reason);
    }
  }

  // Groq key absent — try OpenAI directly
  return _tryOpenAI(config, openaiFactory, "groq_key_missing");
}

function _tryOpenAI(
  config: LLMRouterConfig,
  factory: (opts: unknown) => LLM,
  fallbackReason: string,
): LLMRouterResult | null {
  if (!config.openaiApiKey) return null;
  try {
    const llm = factory({
      model: config.openaiModel ?? DEFAULT_OPENAI_MODEL,
      apiKey: config.openaiApiKey,
      // No baseURL override — uses OpenAI native endpoint
    });
    return {
      llm,
      providerName: "openai",
      fallbackUsed: true,
      reason: fallbackReason,
    };
  } catch {
    return null;
  }
}
