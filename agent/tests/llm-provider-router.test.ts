/**
 * Tests for agent/providers/llm-provider-router.ts (Fase 11)
 *
 * Uses injectable factory stubs to avoid real SDK construction or network calls.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createLLMProvider,
  GROQ_BASE_URL,
  DEFAULT_GROQ_MODEL,
  DEFAULT_OPENAI_MODEL,
  EMERGENCY_LLM_FILLERS,
  type LLMRouterConfig,
  type LLMRouterResult,
} from "../providers/llm-provider-router.js";

// Minimal stub satisfying the LLM type shape — tests only care about the object identity.
function makeFakeLLM(id = "stub") {
  return { _id: id } as unknown as import("@livekit/agents-plugin-openai").LLM;
}

describe("createLLMProvider", () => {
  it("returns null when no API keys are provided", () => {
    const result = createLLMProvider({});
    assert.strictEqual(result, null);
  });

  it("returns null when only groqApiKey is absent and openaiApiKey is absent", () => {
    const result = createLLMProvider({
      groqApiKey: undefined,
      openaiApiKey: undefined,
    });
    assert.strictEqual(result, null);
  });

  it("returns Groq as primary provider when groqApiKey is present", () => {
    const fakeLLM = makeFakeLLM("groq-instance");
    const result = createLLMProvider({
      groqApiKey: "gsk_test",
      _groqFactory: () => fakeLLM,
    });
    assert.ok(result !== null);
    assert.strictEqual(result.providerName, "groq");
    assert.strictEqual(result.fallbackUsed, false);
    assert.strictEqual(result.llm, fakeLLM);
    assert.strictEqual(result.reason, undefined);
  });

  it("falls back to OpenAI when groqApiKey is missing but openaiApiKey is present", () => {
    const fakeLLM = makeFakeLLM("openai-instance");
    const result = createLLMProvider({
      openaiApiKey: "sk_test",
      _openaiFactory: () => fakeLLM,
    });
    assert.ok(result !== null);
    assert.strictEqual(result.providerName, "openai");
    assert.strictEqual(result.fallbackUsed, true);
    assert.strictEqual(result.llm, fakeLLM);
    assert.ok(result.reason?.includes("groq_key_missing"));
  });

  it("falls back to OpenAI when Groq constructor throws", () => {
    const fakeOpenAI = makeFakeLLM("openai-fallback");
    const result = createLLMProvider({
      groqApiKey: "gsk_bad",
      openaiApiKey: "sk_good",
      _groqFactory: () => {
        throw new Error("groq init failed");
      },
      _openaiFactory: () => fakeOpenAI,
    });
    assert.ok(result !== null);
    assert.strictEqual(result.providerName, "openai");
    assert.strictEqual(result.fallbackUsed, true);
    assert.ok(result.reason?.includes("groq_constructor_failed"));
    assert.ok(result.reason?.includes("groq init failed"));
  });

  it("returns null when both Groq and OpenAI constructors throw", () => {
    const result = createLLMProvider({
      groqApiKey: "gsk_bad",
      openaiApiKey: "sk_bad",
      _groqFactory: () => {
        throw new Error("groq down");
      },
      _openaiFactory: () => {
        throw new Error("openai down");
      },
    });
    assert.strictEqual(result, null);
  });

  it("returns null when Groq key missing and OpenAI constructor throws", () => {
    const result = createLLMProvider({
      openaiApiKey: "sk_bad",
      _openaiFactory: () => {
        throw new Error("openai fails");
      },
    });
    assert.strictEqual(result, null);
  });

  it("passes correct baseURL and model to Groq factory", () => {
    let capturedOpts: unknown;
    const fakeLLM = makeFakeLLM("g");
    createLLMProvider({
      groqApiKey: "gsk_key",
      _groqFactory: (opts) => {
        capturedOpts = opts;
        return fakeLLM;
      },
    });
    assert.ok(capturedOpts !== null && typeof capturedOpts === "object");
    const opts = capturedOpts as Record<string, unknown>;
    assert.strictEqual(opts["baseURL"], GROQ_BASE_URL);
    assert.strictEqual(opts["apiKey"], "gsk_key");
    assert.strictEqual(opts["model"], DEFAULT_GROQ_MODEL);
  });

  it("passes correct apiKey and model to OpenAI fallback factory", () => {
    let capturedOpts: unknown;
    const fakeLLM = makeFakeLLM("o");
    createLLMProvider({
      openaiApiKey: "sk_the_key",
      _openaiFactory: (opts) => {
        capturedOpts = opts;
        return fakeLLM;
      },
    });
    const opts = capturedOpts as Record<string, unknown>;
    assert.strictEqual(opts["apiKey"], "sk_the_key");
    assert.strictEqual(opts["model"], DEFAULT_OPENAI_MODEL);
    // No baseURL override for native OpenAI
    assert.ok(!("baseURL" in opts));
  });

  it("uses custom groqModel when provided", () => {
    let capturedOpts: unknown;
    const fakeLLM = makeFakeLLM("g2");
    createLLMProvider({
      groqApiKey: "gsk_key",
      groqModel: "llama3-70b-8192",
      _groqFactory: (opts) => {
        capturedOpts = opts;
        return fakeLLM;
      },
    });
    const opts = capturedOpts as Record<string, unknown>;
    assert.strictEqual(opts["model"], "llama3-70b-8192");
  });

  it("uses custom openaiModel when falling back to OpenAI", () => {
    let capturedOpts: unknown;
    const fakeLLM = makeFakeLLM("o2");
    createLLMProvider({
      openaiApiKey: "sk_key",
      openaiModel: "gpt-4o",
      _openaiFactory: (opts) => {
        capturedOpts = opts;
        return fakeLLM;
      },
    });
    const opts = capturedOpts as Record<string, unknown>;
    assert.strictEqual(opts["model"], "gpt-4o");
  });

  it("prefers Groq over OpenAI when both keys are present", () => {
    const groqLLM = makeFakeLLM("groq-wins");
    const openaiLLM = makeFakeLLM("openai-unused");
    const result = createLLMProvider({
      groqApiKey: "gsk_key",
      openaiApiKey: "sk_key",
      _groqFactory: () => groqLLM,
      _openaiFactory: () => openaiLLM,
    });
    assert.ok(result !== null);
    assert.strictEqual(result.providerName, "groq");
    assert.strictEqual(result.llm, groqLLM);
  });
});

describe("EMERGENCY_LLM_FILLERS", () => {
  it("contains expected keys", () => {
    assert.ok("llm_slow" in EMERGENCY_LLM_FILLERS);
    assert.ok("llm_timeout" in EMERGENCY_LLM_FILLERS);
    assert.ok("llm_unavailable" in EMERGENCY_LLM_FILLERS);
    assert.ok("transfer" in EMERGENCY_LLM_FILLERS);
  });

  it("all values are non-empty strings", () => {
    for (const [k, v] of Object.entries(EMERGENCY_LLM_FILLERS)) {
      assert.strictEqual(typeof v, "string", `key ${k} should be string`);
      assert.ok(v.length > 0, `key ${k} should not be empty`);
    }
  });
});
