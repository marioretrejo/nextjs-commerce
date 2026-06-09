/**
 * TTS Provider Router — Fase 8 TTS Fallback
 *
 * Tries to create a Cartesia TTS instance as the primary provider.
 * If Cartesia construction fails (missing key, constructor error), falls back
 * to OpenAI TTS if OPENAI_API_KEY is available.
 *
 * This is a pure factory function — no singleton state between calls.
 * Each call session gets its own provider instance.
 *
 * NOTE: Mid-session TTS swap is architecturally not possible with LiveKit's
 * AgentSession (the `tts` field is bound at session creation). The fallback
 * here applies only at session construction time. TTFB failures during a call
 * are observed and logged but the provider cannot be hot-swapped.
 */
import { TTS as CartesiaTTS } from "@livekit/agents-plugin-cartesia";
import { TTS as OpenAITTS } from "@livekit/agents-plugin-openai";

export type TTSProviderName = "cartesia" | "openai" | "emergency";

export type TTSProviderState = "healthy" | "degraded" | "down";

export interface TTSRouterConfig {
  cartesiaApiKey?: string;
  openaiApiKey?: string;
  /** Cartesia voice UUID */
  voiceId?: string;
  /** BCP-47 language tag, e.g. 'es' */
  language?: string;
  /** Cartesia model, e.g. 'sonic-multilingual' */
  ttsModel?: string;
  /** Cartesia emotion control tags, e.g. ['positivity:highest'] */
  emotion?: string[] | null;
  /** ms before an incomplete chunk stream is aborted (Cartesia-specific) */
  chunkTimeout?: number;
  /** Injected constructors for testing — callers override to stub behavior */
  _cartesiaFactory?: (opts: unknown) => CartesiaTTS;
  _openaiFactory?: (opts: unknown) => OpenAITTS;
}

export interface TTSRouterResult {
  tts: CartesiaTTS | OpenAITTS;
  providerName: TTSProviderName;
  fallbackUsed: boolean;
  reason?: string;
}

/**
 * Emergency filler phrases for each failure scenario.
 * Used as a last resort if TTS provider swap is not possible mid-call.
 * Kept short so a future text-to-audio bridge can be added without latency spike.
 */
export const EMERGENCY_PHRASES: Readonly<Record<string, string>> = {
  tts_timeout: "Un momento, por favor.",
  provider_failure: "Disculpe, estamos experimentando problemas técnicos.",
  circuit_breaker:
    "I'm sorry, your account has reached its credit limit. The call will end now. Goodbye!",
  insufficient_funds:
    "I'm sorry, your account has insufficient balance. Please top up to continue. Goodbye!",
};

/**
 * Attempt to create a TTS provider, falling back to OpenAI if Cartesia fails.
 *
 * Returns null only if BOTH Cartesia and OpenAI construction fail, or if neither
 * API key is configured.
 */
export function createTTSProvider(
  config: TTSRouterConfig,
): TTSRouterResult | null {
  const cartesiaFactory =
    config._cartesiaFactory ?? ((opts) => new CartesiaTTS(opts as any));
  const openaiFactory =
    config._openaiFactory ?? ((opts) => new OpenAITTS(opts as any));

  // ── Primary: Cartesia ─────────────────────────────────────────────────────
  if (config.cartesiaApiKey) {
    try {
      const opts: Record<string, unknown> = {
        model: config.ttsModel ?? "sonic-multilingual",
        voice: config.voiceId,
        apiKey: config.cartesiaApiKey,
        language: config.language ?? "es",
        chunkTimeout: config.chunkTimeout ?? 8_000,
      };
      if (config.emotion && config.emotion.length > 0) {
        opts["emotion"] = config.emotion;
      }
      const tts = cartesiaFactory(opts);
      return { tts, providerName: "cartesia", fallbackUsed: false };
    } catch (err) {
      console.warn(
        "[tts-router] CartesiaTTS constructor failed, trying OpenAI fallback:",
        String(err),
      );
    }
  }

  // ── Fallback: OpenAI TTS ──────────────────────────────────────────────────
  if (config.openaiApiKey) {
    try {
      const tts = openaiFactory({
        model: "tts-1", // lower latency than tts-1-hd; sufficient for real-time voice
        voice: "nova", // closest neutral assistant voice
        apiKey: config.openaiApiKey,
      });
      const reason = config.cartesiaApiKey
        ? "cartesia_constructor_failed"
        : "cartesia_api_key_missing";
      return { tts, providerName: "openai", fallbackUsed: true, reason };
    } catch (err) {
      console.warn(
        "[tts-router] OpenAITTS constructor also failed — no TTS provider available:",
        String(err),
      );
    }
  }

  // ── No provider ───────────────────────────────────────────────────────────
  console.error(
    "[tts-router] No TTS provider could be constructed. Cartesia and OpenAI both failed or unconfigured.",
  );
  return null;
}
