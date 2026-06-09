/**
 * Tests for Twilio webhook validation helpers
 * Run with: pnpm tsx agent/tests/twilio-validation.test.ts
 *
 * Note: validateTwilioRequest uses the twilio SDK for HMAC-SHA1.
 * These tests focus on shouldValidateTwilio() and the guard logic
 * around it (missing token, missing header, env-var bypass).
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// ── Helpers ───────────────────────────────────────────────────────────────────

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

const saved: Record<string, string | undefined> = {};

function saveAndSet(
  envs: Partial<Record<string, string | undefined>>,
): () => void {
  const keys = Object.keys(envs);
  for (const k of keys) saved[k] = process.env[k];
  for (const [k, v] of Object.entries(envs)) setEnv(k, v);
  return () => {
    for (const k of keys) setEnv(k, saved[k]);
  };
}

// ── Dynamic import so env mutations take effect ───────────────────────────────

async function importValidate() {
  // Force re-evaluation is not possible in ESM without a cache bust trick;
  // instead we call the functions and test shouldValidateTwilio() logic directly.
  const mod = await import("../../lib/twilio/validate.js");
  return mod;
}

// ── shouldValidateTwilio tests ────────────────────────────────────────────────

test("shouldValidateTwilio: always true in production regardless of env var", async () => {
  const restore = saveAndSet({
    NODE_ENV: "production",
    TWILIO_WEBHOOK_VALIDATION_DISABLED: "true",
  });
  try {
    const { shouldValidateTwilio } = await importValidate();
    assert.equal(
      shouldValidateTwilio(),
      true,
      "production must always validate even if disabled flag is set",
    );
  } finally {
    restore();
  }
});

test("shouldValidateTwilio: true in non-prod when flag is absent", async () => {
  const restore = saveAndSet({
    NODE_ENV: "test",
    TWILIO_WEBHOOK_VALIDATION_DISABLED: undefined,
  });
  try {
    const { shouldValidateTwilio } = await importValidate();
    assert.equal(shouldValidateTwilio(), true);
  } finally {
    restore();
  }
});

test("shouldValidateTwilio: false in non-prod when flag is 'true'", async () => {
  const restore = saveAndSet({
    NODE_ENV: "development",
    TWILIO_WEBHOOK_VALIDATION_DISABLED: "true",
  });
  try {
    const { shouldValidateTwilio } = await importValidate();
    assert.equal(shouldValidateTwilio(), false);
  } finally {
    restore();
  }
});

test("shouldValidateTwilio: true when flag is 'false' string", async () => {
  const restore = saveAndSet({
    NODE_ENV: "development",
    TWILIO_WEBHOOK_VALIDATION_DISABLED: "false",
  });
  try {
    const { shouldValidateTwilio } = await importValidate();
    assert.equal(shouldValidateTwilio(), true);
  } finally {
    restore();
  }
});

// ── validateTwilioRequest tests ───────────────────────────────────────────────

test("validateTwilioRequest: returns false when TWILIO_AUTH_TOKEN is missing", async () => {
  const restore = saveAndSet({ TWILIO_AUTH_TOKEN: undefined });
  try {
    const { validateTwilioRequest } = await importValidate();
    const req = new Request("https://example.com/webhook", {
      headers: { "x-twilio-signature": "somesig" },
    });
    assert.equal(
      validateTwilioRequest(
        req,
        "CallSid=CA123",
        "https://example.com",
        "/webhook",
      ),
      false,
    );
  } finally {
    restore();
  }
});

test("validateTwilioRequest: returns false when X-Twilio-Signature header is absent", async () => {
  const restore = saveAndSet({ TWILIO_AUTH_TOKEN: "test_auth_token_abc123" });
  try {
    const { validateTwilioRequest } = await importValidate();
    const req = new Request("https://example.com/webhook");
    // No x-twilio-signature header
    assert.equal(
      validateTwilioRequest(
        req,
        "CallSid=CA123",
        "https://example.com",
        "/webhook",
      ),
      false,
    );
  } finally {
    restore();
  }
});

test("validateTwilioRequest: returns false for an invalid/forged signature", async () => {
  const restore = saveAndSet({ TWILIO_AUTH_TOKEN: "real_token_xyz789" });
  try {
    const { validateTwilioRequest } = await importValidate();
    const req = new Request("https://example.com/webhook", {
      headers: { "x-twilio-signature": "forged_signature_value" },
    });
    assert.equal(
      validateTwilioRequest(
        req,
        "CallSid=CA123&CallStatus=ringing",
        "https://example.com",
        "/webhook",
      ),
      false,
    );
  } finally {
    restore();
  }
});

console.log("✓ twilio-validation tests complete");
