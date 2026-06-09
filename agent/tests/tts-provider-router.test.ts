/**
 * Unit tests: TTS Provider Router
 *
 * Verifies constructor-level fallback behaviour using injectable factory stubs
 * so no real Cartesia/OpenAI HTTP connection is made.
 *
 * Run with: pnpm tsx agent/tests/tts-provider-router.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTTSProvider,
  EMERGENCY_PHRASES,
} from "../providers/tts-provider-router.js";
import type { TTSRouterConfig } from "../providers/tts-provider-router.js";

// Minimal stubs — enough to satisfy the TypeScript types without real SDK deps
const CARTESIA_STUB = { __type: "cartesia" } as unknown as ReturnType<
  NonNullable<TTSRouterConfig["_cartesiaFactory"]>
>;
const OPENAI_STUB = { __type: "openai" } as unknown as ReturnType<
  NonNullable<TTSRouterConfig["_openaiFactory"]>
>;

function cartesiaOk(): TTSRouterConfig["_cartesiaFactory"] {
  return () => CARTESIA_STUB;
}
function cartesiaFails(): TTSRouterConfig["_cartesiaFactory"] {
  return () => {
    throw new Error("Simulated Cartesia constructor failure");
  };
}
function openaiOk(): TTSRouterConfig["_openaiFactory"] {
  return () => OPENAI_STUB;
}
function openaiFails(): TTSRouterConfig["_openaiFactory"] {
  return () => {
    throw new Error("Simulated OpenAI constructor failure");
  };
}

// ── createTTSProvider — normal path ──────────────────────────────────────────

test("createTTSProvider: Cartesia selected when key present and constructor succeeds", () => {
  const result = createTTSProvider({
    cartesiaApiKey: "crt-key",
    _cartesiaFactory: cartesiaOk(),
  });
  assert.ok(result !== null, "should return a result");
  assert.equal(result!.providerName, "cartesia");
  assert.equal(result!.fallbackUsed, false);
  assert.equal(result!.reason, undefined);
  assert.equal(result!.tts, CARTESIA_STUB);
});

test("createTTSProvider: OpenAI fallback selected when Cartesia constructor fails", () => {
  const result = createTTSProvider({
    cartesiaApiKey: "crt-key",
    openaiApiKey: "oai-key",
    _cartesiaFactory: cartesiaFails(),
    _openaiFactory: openaiOk(),
  });
  assert.ok(result !== null);
  assert.equal(result!.providerName, "openai");
  assert.equal(result!.fallbackUsed, true);
  assert.equal(result!.reason, "cartesia_constructor_failed");
  assert.equal(result!.tts, OPENAI_STUB);
});

test("createTTSProvider: OpenAI fallback when cartesiaApiKey is missing", () => {
  const result = createTTSProvider({
    openaiApiKey: "oai-key",
    _openaiFactory: openaiOk(),
  });
  assert.ok(result !== null);
  assert.equal(result!.providerName, "openai");
  assert.equal(result!.fallbackUsed, true);
  assert.equal(result!.reason, "cartesia_api_key_missing");
});

test("createTTSProvider: returns null when both providers fail", () => {
  const result = createTTSProvider({
    cartesiaApiKey: "crt-key",
    openaiApiKey: "oai-key",
    _cartesiaFactory: cartesiaFails(),
    _openaiFactory: openaiFails(),
  });
  assert.equal(result, null);
});

test("createTTSProvider: returns null when no API keys provided", () => {
  const result = createTTSProvider({});
  assert.equal(result, null);
});

test("createTTSProvider: returns null when both keys missing and no factories", () => {
  const result = createTTSProvider({
    _cartesiaFactory: cartesiaFails(),
    _openaiFactory: openaiFails(),
  });
  assert.equal(
    result,
    null,
    "no keys = Cartesia block skipped, no OpenAI key = OpenAI block skipped",
  );
});

// ── Provider selection logic ──────────────────────────────────────────────────

test("createTTSProvider: Cartesia key present + OpenAI key present → Cartesia wins when healthy", () => {
  const result = createTTSProvider({
    cartesiaApiKey: "crt-key",
    openaiApiKey: "oai-key",
    _cartesiaFactory: cartesiaOk(),
    _openaiFactory: openaiOk(),
  });
  assert.ok(result !== null);
  assert.equal(result!.providerName, "cartesia");
  assert.equal(result!.fallbackUsed, false);
});

test("createTTSProvider: Cartesia key missing + OpenAI key present → OpenAI with reason cartesia_api_key_missing", () => {
  const result = createTTSProvider({
    openaiApiKey: "oai-key",
    _openaiFactory: openaiOk(),
  });
  assert.ok(result !== null);
  assert.equal(result!.providerName, "openai");
  assert.equal(result!.reason, "cartesia_api_key_missing");
});

// ── EMERGENCY_PHRASES ─────────────────────────────────────────────────────────

test("EMERGENCY_PHRASES: tts_timeout phrase exists and is non-empty", () => {
  assert.ok(
    typeof EMERGENCY_PHRASES["tts_timeout"] === "string" &&
      EMERGENCY_PHRASES["tts_timeout"].length > 0,
    "tts_timeout phrase should be a non-empty string",
  );
});

test("EMERGENCY_PHRASES: circuit_breaker phrase exists and is non-empty", () => {
  assert.ok(
    typeof EMERGENCY_PHRASES["circuit_breaker"] === "string" &&
      EMERGENCY_PHRASES["circuit_breaker"].length > 0,
  );
});

test("EMERGENCY_PHRASES: provider_failure phrase exists and is non-empty", () => {
  assert.ok(
    typeof EMERGENCY_PHRASES["provider_failure"] === "string" &&
      EMERGENCY_PHRASES["provider_failure"].length > 0,
  );
});

test("EMERGENCY_PHRASES: insufficient_funds phrase exists and is non-empty", () => {
  assert.ok(
    typeof EMERGENCY_PHRASES["insufficient_funds"] === "string" &&
      EMERGENCY_PHRASES["insufficient_funds"].length > 0,
  );
});

// ── voiceId / emotion forwarding ─────────────────────────────────────────────

test("createTTSProvider: voiceId and emotion forwarded to Cartesia factory", () => {
  let capturedOpts: unknown;
  const result = createTTSProvider({
    cartesiaApiKey: "crt-key",
    voiceId: "voice-uuid-123",
    emotion: ["positivity:highest"],
    _cartesiaFactory: (opts) => {
      capturedOpts = opts;
      return CARTESIA_STUB;
    },
  });
  assert.ok(result !== null);
  const opts = capturedOpts as Record<string, unknown>;
  assert.equal(opts["voice"], "voice-uuid-123");
  assert.deepEqual(opts["emotion"], ["positivity:highest"]);
});

test("createTTSProvider: null emotion is not forwarded to Cartesia factory", () => {
  let capturedOpts: unknown;
  createTTSProvider({
    cartesiaApiKey: "crt-key",
    emotion: null,
    _cartesiaFactory: (opts) => {
      capturedOpts = opts;
      return CARTESIA_STUB;
    },
  });
  const opts = capturedOpts as Record<string, unknown>;
  assert.ok(
    !("emotion" in opts),
    "null emotion should not be included in opts",
  );
});

console.log("✓ tts-provider-router tests complete");
