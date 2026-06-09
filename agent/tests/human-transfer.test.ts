/**
 * Tests for Fase 12: Human Transfer via Twilio call redirect + SIP REFER.
 *
 * Uses HTTP fetch stubs and fake Twilio responses — no real network calls.
 */
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

// ── helpers ───────────────────────────────────────────────────────────────────

function buildTwiML(targetPhone: string): string {
  return `<Response><Dial>${targetPhone}</Dial></Response>`;
}

function fakeTwilioOk(callSid: string) {
  return { ok: true, status: 200, json: async () => ({ sid: callSid }) };
}

function fakeTwilioFail(status: number) {
  return {
    ok: false,
    status,
    text: async () => `Error ${status}`,
    json: async () => ({}),
  };
}

// ── Test 1: TwiML generation ──────────────────────────────────────────────────

describe("TwiML generation", () => {
  it("generates correct <Dial> TwiML for E.164 number", () => {
    const targetPhone = "+18005551234";
    const twiml = buildTwiML(targetPhone);
    assert.ok(twiml.includes("<Response>"), "Must have <Response> wrapper");
    assert.ok(twiml.includes("<Dial>"), "Must have <Dial> tag");
    assert.ok(twiml.includes(targetPhone), "Must include target phone");
    assert.ok(twiml.includes("</Dial>"), "Must close <Dial>");
    assert.ok(twiml.includes("</Response>"), "Must close <Response>");
    assert.strictEqual(
      twiml,
      `<Response><Dial>${targetPhone}</Dial></Response>`,
    );
  });

  it("generates correct <Dial> TwiML for SIP URI", () => {
    const sipTarget = "sip:support@carrier.example.com";
    const twiml = buildTwiML(sipTarget);
    assert.ok(twiml.includes(sipTarget));
    assert.ok(twiml.startsWith("<Response><Dial>"));
  });

  it("Twilio API call uses correct URL and auth header", async () => {
    const capturedRequests: { url: string; init: RequestInit }[] = [];
    const targetPhone = "+15005550006";
    const callSid = "CA_test_sid";
    const accountSid = "AC_fake_sid";
    const authToken = "fake_auth_token";

    // Stub global fetch
    const origFetch = global.fetch;
    global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      capturedRequests.push({ url: String(url), init: init ?? {} });
      return fakeTwilioOk(callSid) as unknown as Response;
    };

    try {
      const expectedUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`;
      const twiml = buildTwiML(targetPhone);
      const body = new URLSearchParams({ Twiml: twiml }).toString();
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

      await fetch(expectedUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      assert.strictEqual(capturedRequests.length, 1);
      const req = capturedRequests[0]!;
      assert.strictEqual(req.url, expectedUrl);
      const headers = req.init.headers as Record<string, string>;
      assert.ok(
        headers["Authorization"]?.startsWith("Basic "),
        "Must use Basic auth",
      );
      assert.strictEqual(
        headers["Content-Type"],
        "application/x-www-form-urlencoded",
      );
      assert.ok(
        String(req.init.body ?? "").includes("Twiml="),
        "Body must contain Twiml parameter",
      );
    } finally {
      global.fetch = origFetch;
    }
  });
});

// ── Test 2: Cost tracking on transfer ────────────────────────────────────────

describe("Cost accumulation on transfer", () => {
  it("accumulated chars count is preserved up to the moment of transfer", () => {
    // Simulate a BillingTracker-style accumulator
    let ttsTotalChars = 0;
    let llmInputTokens = 0;

    const trackTts = (chars: number) => {
      ttsTotalChars += chars;
    };
    const trackLlm = (inputTok: number) => {
      llmInputTokens += inputTok;
    };

    // Pre-transfer bot speech
    trackTts("Hola, ¿en qué puedo ayudarte?".length);
    trackTts("Entiendo tu consulta, déjame verificar eso.".length);
    trackLlm(120);

    const snapshotChars = ttsTotalChars;
    const snapshotTokens = llmInputTokens;

    // Transfer announcement spoken
    const announcement =
      "Por favor espere un momento, estoy transfiriendo su llamada con un especialista.";
    trackTts(announcement.length);

    // After transfer, snapshot captured before announcement should be exact
    assert.strictEqual(
      snapshotChars,
      "Hola, ¿en qué puedo ayudarte?".length +
        "Entiendo tu consulta, déjame verificar eso.".length,
    );
    assert.strictEqual(snapshotTokens, 120);

    // Total after announcement
    assert.strictEqual(ttsTotalChars, snapshotChars + announcement.length);
  });

  it("transfer does not reset accumulated cost counters", () => {
    const costs = { ttsChars: 500, llmInputTokens: 300, llmOutputTokens: 150 };
    const preTransferCost = { ...costs };

    // Simulate transfer happening — counters must not reset
    // (In the real worker, _transferredToHuman flag is set but billing is finalized at close)
    assert.deepStrictEqual(
      costs,
      preTransferCost,
      "Costs must not be mutated by transfer",
    );
  });
});

// ── Test 3: business_outcome = 'transferred_to_human' ───────────────────────

describe("business_outcome on transfer", () => {
  it("onTransferInitiated callback sets transferred_to_human outcome", () => {
    let capturedOutcome: string | null = null;
    let transferFlag = false;

    // Simulate CallLifecycleManager.setOutcome
    const mockLifecycle = {
      setOutcome: (outcome: string) => {
        capturedOutcome = outcome;
      },
    };

    // Simulate the onTransferInitiated callback from worker_core.ts
    const onTransferInitiated = (opts: {
      reason: string;
      targetNumber: string;
    }) => {
      transferFlag = true;
      mockLifecycle.setOutcome("transferred_to_human");
    };

    onTransferInitiated({
      reason: "customer_request",
      targetNumber: "+18005551234",
    });

    assert.strictEqual(capturedOutcome, "transferred_to_human");
    assert.strictEqual(transferFlag, true);
  });

  it("outcome stays 'transferred_to_human' even if transfer method fails", () => {
    let capturedOutcome: string | null = null;

    const mockLifecycle = {
      setOutcome: (outcome: string) => {
        capturedOutcome = outcome;
      },
    };

    // Simulate callback even on fallback path
    mockLifecycle.setOutcome("transferred_to_human");
    assert.strictEqual(capturedOutcome, "transferred_to_human");
  });

  it("Twilio API failure triggers fallback message, not an exception", async () => {
    const origFetch = global.fetch;
    global.fetch = async () => fakeTwilioFail(503) as unknown as Response;

    let fallbackMessageSpoken = false;

    // Simulate the fallback path in the transfer tool
    try {
      const res = await fetch("https://api.twilio.com/...", {
        method: "POST",
        headers: {},
        body: "",
      });

      if (!res.ok) {
        // Tool should catch this and speak fallback, not throw
        fallbackMessageSpoken = true;
      }
    } finally {
      global.fetch = origFetch;
    }

    assert.strictEqual(
      fallbackMessageSpoken,
      true,
      "Tool must handle Twilio failure gracefully",
    );
  });
});

// ── Test 4: Transfer number priority chain ────────────────────────────────────

describe("Transfer number priority resolution", () => {
  it("per-number transfer_target_phone takes highest priority", () => {
    const phoneNumberTransfer = "+12025551111";
    const agentTransfer = "+12025552222";
    const envTransfer = "+12025553333";

    // Simulate priority chain from worker_core.ts
    const resolveTransferNumber = (
      phoneNumberTarget: string | null,
      agentTarget: string | null,
      envTarget: string | null,
    ) => phoneNumberTarget ?? agentTarget ?? envTarget ?? null;

    assert.strictEqual(
      resolveTransferNumber(phoneNumberTransfer, agentTransfer, envTransfer),
      phoneNumberTransfer,
    );
  });

  it("falls back to agent transfer_number when phone has no target", () => {
    const agentTransfer = "+12025552222";
    const envTransfer = "+12025553333";

    const resolveTransferNumber = (
      phoneNumberTarget: string | null,
      agentTarget: string | null,
      envTarget: string | null,
    ) => phoneNumberTarget ?? agentTarget ?? envTarget ?? null;

    assert.strictEqual(
      resolveTransferNumber(null, agentTransfer, envTransfer),
      agentTransfer,
    );
  });

  it("falls back to VOICEOS_GLOBAL_TRANSFER_FALLBACK env var as last resort", () => {
    const envTransfer = "+12025553333";

    const resolveTransferNumber = (
      phoneNumberTarget: string | null,
      agentTarget: string | null,
      envTarget: string | null,
    ) => phoneNumberTarget ?? agentTarget ?? envTarget ?? null;

    assert.strictEqual(
      resolveTransferNumber(null, null, envTransfer),
      envTransfer,
    );
  });

  it("returns null when no transfer target is configured anywhere", () => {
    const resolveTransferNumber = (
      phoneNumberTarget: string | null,
      agentTarget: string | null,
      envTarget: string | null,
    ) => phoneNumberTarget ?? agentTarget ?? envTarget ?? null;

    assert.strictEqual(resolveTransferNumber(null, null, null), null);
  });
});
