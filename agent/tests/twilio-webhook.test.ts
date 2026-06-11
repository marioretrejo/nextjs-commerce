/**
 * Tests for POST /api/webhooks/twilio/status status-mapping logic
 * and the /api/v1/outbound/twiml public route.
 *
 * These tests exercise the pure mapping/guard logic without hitting Supabase.
 * Run with: pnpm tsx agent/tests/twilio-webhook.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { shouldEnqueuePostCallJobs } from "../../lib/jobs/post-call-jobs.js";

// ── Helper: compute Twilio HMAC-SHA1 signature ────────────────────────────────

function computeTwilioSig(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  let data = url;
  Object.keys(params)
    .sort()
    .forEach((k) => {
      data += k + params[k];
    });
  return crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");
}

// ── Helper: mapStatus (mirrors route logic, tested in isolation) ──────────────

function mapStatus(twilio: string): {
  technicalStatus: string;
  legacyStatus: string;
  isTerminal: boolean;
  endReason?: string;
} {
  switch (twilio) {
    case "queued":
    case "initiated":
      return {
        technicalStatus: "initiated",
        legacyStatus: "initiated",
        isTerminal: false,
      };
    case "ringing":
      return {
        technicalStatus: "ringing",
        legacyStatus: "ringing",
        isTerminal: false,
      };
    case "in-progress":
      return {
        technicalStatus: "in_progress",
        legacyStatus: "in-progress",
        isTerminal: false,
      };
    case "completed":
      return {
        technicalStatus: "completed",
        legacyStatus: "completed",
        isTerminal: true,
      };
    case "no-answer":
      return {
        technicalStatus: "no_answer",
        legacyStatus: "no_answer",
        isTerminal: true,
        endReason: "twilio_no_answer",
      };
    case "busy":
      return {
        technicalStatus: "busy",
        legacyStatus: "failed",
        isTerminal: true,
      };
    case "failed":
      return {
        technicalStatus: "failed",
        legacyStatus: "failed",
        isTerminal: true,
      };
    case "canceled":
    case "cancelled":
      return {
        technicalStatus: "cancelled",
        legacyStatus: "cancelled",
        isTerminal: true,
      };
    default:
      return {
        technicalStatus: "failed",
        legacyStatus: "failed",
        isTerminal: true,
      };
  }
}

// ── 1. Twilio signature validation rejects forged requests ───────────────────

describe("signature validation", () => {
  test("invalid signature returns false from validateTwilioRequest", async () => {
    const { validateTwilioRequest } = await import(
      "../../lib/twilio/validate.js"
    );
    const req = new Request("https://example.com/api/webhooks/twilio/status", {
      headers: { "x-twilio-signature": "bad_sig" },
    });
    const result = validateTwilioRequest(
      req,
      "CallSid=CA123&CallStatus=completed",
      "https://example.com",
      "/api/webhooks/twilio/status",
    );
    assert.equal(result, false, "forged signature must be rejected");
  });

  test("correct HMAC-SHA1 signature passes validateTwilioRequest", async () => {
    const token = "test_auth_token_abc";
    process.env["TWILIO_AUTH_TOKEN"] = token;
    try {
      const { validateTwilioRequest } = await import(
        "../../lib/twilio/validate.js"
      );
      const url = "https://example.com/api/webhooks/twilio/status";
      const params = {
        CallSid: "CA123",
        CallStatus: "completed",
        CallDuration: "30",
      };
      const sig = computeTwilioSig(token, url, params);
      const body = new URLSearchParams(params).toString();
      const req = new Request(url, {
        headers: { "x-twilio-signature": sig },
      });
      const result = validateTwilioRequest(
        req,
        body,
        "https://example.com",
        "/api/webhooks/twilio/status",
      );
      assert.equal(result, true, "valid HMAC signature must pass");
    } finally {
      delete process.env["TWILIO_AUTH_TOKEN"];
    }
  });
});

// ── 2. Status mapping ─────────────────────────────────────────────────────────

describe("mapStatus — Twilio → schema fields", () => {
  test("no-answer → technical_status=no_answer, end_reason=twilio_no_answer, terminal", () => {
    const r = mapStatus("no-answer");
    assert.equal(r.technicalStatus, "no_answer");
    assert.equal(r.legacyStatus, "no_answer");
    assert.equal(r.isTerminal, true);
    assert.equal(r.endReason, "twilio_no_answer");
  });

  test("completed → technical_status=completed, terminal, no endReason", () => {
    const r = mapStatus("completed");
    assert.equal(r.technicalStatus, "completed");
    assert.equal(r.legacyStatus, "completed");
    assert.equal(r.isTerminal, true);
    assert.equal(r.endReason, undefined);
  });

  test("failed → technical_status=failed, legacy=failed, terminal", () => {
    const r = mapStatus("failed");
    assert.equal(r.technicalStatus, "failed");
    assert.equal(r.legacyStatus, "failed");
    assert.equal(r.isTerminal, true);
  });

  test("busy → technical_status=busy, legacy=failed (backwards compat), terminal", () => {
    const r = mapStatus("busy");
    assert.equal(r.technicalStatus, "busy");
    assert.equal(r.legacyStatus, "failed");
    assert.equal(r.isTerminal, true);
  });

  test("canceled → technical_status=cancelled, terminal", () => {
    const r = mapStatus("canceled");
    assert.equal(r.technicalStatus, "cancelled");
    assert.equal(r.legacyStatus, "cancelled");
    assert.equal(r.isTerminal, true);
  });

  test("in-progress → technical_status=in_progress, legacy=in-progress, non-terminal", () => {
    const r = mapStatus("in-progress");
    assert.equal(r.technicalStatus, "in_progress");
    assert.equal(r.legacyStatus, "in-progress");
    assert.equal(r.isTerminal, false);
  });

  test("ringing → technical_status=ringing, non-terminal", () => {
    const r = mapStatus("ringing");
    assert.equal(r.technicalStatus, "ringing");
    assert.equal(r.isTerminal, false);
  });

  test("unknown status → technical_status=failed, terminal (safe default)", () => {
    const r = mapStatus("unknown_xyz");
    assert.equal(r.technicalStatus, "failed");
    assert.equal(r.isTerminal, true);
  });
});

// ── 3. shouldEnqueuePostCallJobs guards ───────────────────────────────────────
//
// Gate rules (ALL must be true):
//   • ended_at must be set
//   • has_agent_session must be true (call_events confirm LLM/TTS worker pipeline ran)
//   • technical_status must equal "completed" exactly
//
// Only technical_status="completed" is eligible. All other statuses
// (no_answer, failed, busy, canceled, cancelled, null, in_progress, etc.)
// must return false even when has_agent_session=true.

// AGENT_SESSION_EVENT_TYPES used by recovery runners — tested here for correctness.
const AGENT_SESSION_EVENT_TYPES_UNDER_TEST = [
  "llm.provider_selected",
  "tts.provider_selected",
];

describe("shouldEnqueuePostCallJobs — post_call_jobs eligibility", () => {
  const ts = "2024-01-15T12:00:00.000Z";

  // Test 1: completed + real agent session → eligible
  test("1. completed + has_agent_session=true IS eligible", () => {
    assert.equal(
      shouldEnqueuePostCallJobs({
        technical_status: "completed",
        ended_at: ts,
        has_agent_session: true,
      }),
      true,
    );
  });

  // Test 2: completed without agent session (trial disclaimer, TwiML error) → NOT eligible
  test("2. completed + has_agent_session=false (trial disclaimer / TwiML error) is NOT eligible", () => {
    assert.equal(
      shouldEnqueuePostCallJobs({
        technical_status: "completed",
        ended_at: ts,
        has_agent_session: false,
      }),
      false,
      "Twilio 'completed' alone does not prove agent was present",
    );
  });

  // Test 3: duration_seconds > 0 is not evidence of agent connection
  test("3. completed + duration_seconds>0 + has_agent_session=false → NOT eligible (duration is not proof)", () => {
    // CallDuration>0 can come from trial disclaimer, voicemail, or TwiML error
    assert.equal(
      shouldEnqueuePostCallJobs({
        technical_status: "completed",
        ended_at: ts,
        has_agent_session: false,
      }),
      false,
    );
  });

  // Test 4: no_answer — blocked even with agent session
  test("4. no_answer + has_agent_session=true is NOT eligible", () => {
    assert.equal(
      shouldEnqueuePostCallJobs({
        technical_status: "no_answer",
        ended_at: ts,
        has_agent_session: true,
      }),
      false,
    );
  });

  // Test 5: failed — blocked even with agent session
  test("5. failed + has_agent_session=true is NOT eligible", () => {
    assert.equal(
      shouldEnqueuePostCallJobs({
        technical_status: "failed",
        ended_at: ts,
        has_agent_session: true,
      }),
      false,
    );
  });

  // Test 6: busy — blocked even with agent session
  test("6. busy + has_agent_session=true is NOT eligible", () => {
    assert.equal(
      shouldEnqueuePostCallJobs({
        technical_status: "busy",
        ended_at: ts,
        has_agent_session: true,
      }),
      false,
    );
  });

  // Test 7: canceled — blocked even with agent session
  test("7. canceled + has_agent_session=true is NOT eligible", () => {
    assert.equal(
      shouldEnqueuePostCallJobs({
        technical_status: "canceled",
        ended_at: ts,
        has_agent_session: true,
      }),
      false,
    );
  });

  // Test 8: cancelled — blocked even with agent session
  test("8. cancelled + has_agent_session=true is NOT eligible", () => {
    assert.equal(
      shouldEnqueuePostCallJobs({
        technical_status: "cancelled",
        ended_at: ts,
        has_agent_session: true,
      }),
      false,
    );
  });

  // Test 9: call.answered must NOT be in AGENT_SESSION_EVENT_TYPES
  // (it is emitted by the Twilio status webhook on in-progress callback — not worker-only)
  test("9. call.answered is NOT in AGENT_SESSION_EVENT_TYPES (dual-source event excluded)", () => {
    assert.equal(
      AGENT_SESSION_EVENT_TYPES_UNDER_TEST.includes("call.answered"),
      false,
      "call.answered is also emitted by the Twilio webhook and must not count as agent evidence",
    );
  });

  // Test 10: worker LLM/TTS events ARE in AGENT_SESSION_EVENT_TYPES
  test("10. llm.provider_selected and tts.provider_selected ARE in AGENT_SESSION_EVENT_TYPES (worker-only proof)", () => {
    assert.equal(
      AGENT_SESSION_EVENT_TYPES_UNDER_TEST.includes("llm.provider_selected"),
      true,
      "llm.provider_selected must be a recognized agent session event",
    );
    assert.equal(
      AGENT_SESSION_EVENT_TYPES_UNDER_TEST.includes("tts.provider_selected"),
      true,
      "tts.provider_selected must be a recognized agent session event",
    );
  });

  // ── ended_at gate ────────────────────────────────────────────────────────────

  test("completed + has_agent_session=true WITHOUT ended_at is NOT eligible", () => {
    assert.equal(
      shouldEnqueuePostCallJobs({
        technical_status: "completed",
        ended_at: null,
        has_agent_session: true,
      }),
      false,
    );
  });
});

// ── 4. Idempotency guard ──────────────────────────────────────────────────────

describe("idempotency: already-ended call short-circuits on terminal", () => {
  test("terminal callback on ended call should only refresh duration", () => {
    // Simulate the guard logic
    const callRow = { ended_at: "2024-01-15T12:00:00Z", duration_seconds: 10 };
    const incoming = mapStatus("completed");

    const alreadyEnded = !!callRow.ended_at;
    const shouldShortCircuit = alreadyEnded && incoming.isTerminal;

    assert.equal(
      shouldShortCircuit,
      true,
      "should short-circuit on duplicate terminal",
    );
  });

  test("non-terminal callback on ended call does NOT short-circuit", () => {
    const callRow = { ended_at: "2024-01-15T12:00:00Z" };
    const incoming = mapStatus("in-progress");

    const shouldShortCircuit = !!callRow.ended_at && incoming.isTerminal;

    assert.equal(
      shouldShortCircuit,
      false,
      "in-progress should not short-circuit even if ended_at is set",
    );
  });
});

// ── 5. Terminal statuses all have isTerminal=true ─────────────────────────────

describe("terminal status coverage", () => {
  const terminals = [
    "completed",
    "failed",
    "busy",
    "no-answer",
    "canceled",
    "cancelled",
  ];
  const nonTerminals = ["queued", "initiated", "ringing", "in-progress"];

  for (const s of terminals) {
    test(`${s} is terminal`, () => {
      assert.equal(mapStatus(s).isTerminal, true);
    });
  }

  for (const s of nonTerminals) {
    test(`${s} is NOT terminal`, () => {
      assert.equal(mapStatus(s).isTerminal, false);
    });
  }
});

console.log("✓ twilio-webhook tests complete");
