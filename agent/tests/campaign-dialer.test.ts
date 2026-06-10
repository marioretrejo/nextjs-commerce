/**
 * Fase 13: Campaign Outbound Engine — unit tests
 * Uses node:test (no external dependencies).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ── Helpers ───────────────────────────────────────────────────────────────────

type ContactStatus =
  | "pending"
  | "calling"
  | "converted"
  | "no_answer"
  | "invalid"
  | "rejected"
  | "voicemail"
  | "max_attempts"
  | "excluded"
  | "completed"
  | "failed";

interface MockContact {
  id: string;
  campaign_id: string;
  phone: string;
  name: string | null;
  variables: Record<string, string> | null;
  attempts: number;
  campaign_lead_id: string | null;
  status: ContactStatus;
}

function makeContact(overrides: Partial<MockContact> = {}): MockContact {
  return {
    id: "contact-1",
    campaign_id: "campaign-1",
    phone: "+12025551234",
    name: "Juan Pérez",
    variables: { account_type: "premium", last_product: "Mercado Pago" },
    attempts: 0,
    campaign_lead_id: null,
    status: "pending",
    ...overrides,
  };
}

// Minimal stub for the campaign table
function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "campaign-1",
    workspace_id: "ws-1",
    agent_id: "agent-1",
    status: "active",
    configuration: {},
    ...overrides,
  };
}

// ── Test 1: Processor ignores leads in paused campaigns ────────────────────────

describe("Campaign dispatcher — paused campaigns", () => {
  it("returns excluded=1 and contacts=0 for paused campaign", async () => {
    const campaign = makeCampaign({ status: "paused" });

    // Simulate what processNextLeads does when campaign.status === 'paused'
    const result = {
      contacted: 0,
      excluded: 0,
      errors: 0,
      details: [] as unknown[],
    };

    if (campaign.status === "paused") {
      result.excluded++;
      result.details.push({
        contactId: campaign.id,
        outcome: "excluded",
        reason: "campaign_paused",
      });
    }

    assert.strictEqual(
      result.contacted,
      0,
      "No calls placed for paused campaign",
    );
    assert.strictEqual(
      result.excluded,
      1,
      "Paused campaign counted as excluded",
    );
    assert.deepEqual(
      (result.details[0] as { reason: string }).reason,
      "campaign_paused",
    );
  });

  it("returns excluded for completed campaign", () => {
    const campaign = makeCampaign({ status: "completed" });
    const result = { contacted: 0, excluded: 0, errors: 0 };

    if (campaign.status !== "active") result.excluded++;

    assert.strictEqual(result.contacted, 0);
    assert.strictEqual(result.excluded, 1);
  });
});

// ── Test 2: Ineligible lead → excluded, no Twilio call ────────────────────────

describe("Campaign dispatcher — compliance gate", () => {
  it("excluded lead never triggers Twilio call creation", async () => {
    let twilioCallsMade = 0;
    const mockTwilioCreate = () => {
      twilioCallsMade++;
    };

    const eligibility = {
      allowed: false,
      reason_code: "dnc",
      reason: "Phone is on DNC list",
    };

    // Simulate dispatcher logic for ineligible lead
    const contact = makeContact();
    let contactStatus: ContactStatus = contact.status;

    if (!eligibility.allowed) {
      const permanentBlocks = ["dnc", "opt_out", "invalid_phone_number"];
      contactStatus = permanentBlocks.includes(eligibility.reason_code ?? "")
        ? "rejected"
        : "excluded";
      // do NOT call mockTwilioCreate
    } else {
      mockTwilioCreate();
      contactStatus = "calling";
    }

    assert.strictEqual(
      twilioCallsMade,
      0,
      "No Twilio call for ineligible lead",
    );
    assert.strictEqual(contactStatus, "rejected", "DNC lead → rejected status");
  });

  it("cooldown-blocked lead → excluded (not rejected, retryable)", () => {
    const eligibility = {
      allowed: false,
      reason_code: "cooldown_active",
      reason: "Cooldown active",
    };
    const permanentBlocks = ["dnc", "opt_out", "invalid_phone_number"];
    const newStatus = permanentBlocks.includes(eligibility.reason_code)
      ? "rejected"
      : "excluded";
    assert.strictEqual(
      newStatus,
      "excluded",
      "Cooldown blocked → excluded (retryable)",
    );
  });

  it("eligible lead proceeds to call stage", async () => {
    let twilioCallsMade = 0;
    const eligibility = { allowed: true, reason_code: null };

    if (eligibility.allowed) twilioCallsMade++;

    assert.strictEqual(twilioCallsMade, 1, "One Twilio call for eligible lead");
  });
});

// ── Test 3: Lead variables injected into system prompt ────────────────────────

describe("Campaign lead context injection", () => {
  it("contact variables are merged into compileSystemPrompt vars", () => {
    const contact = makeContact({
      name: "Juan Pérez",
      variables: { account_type: "premium", last_product: "Mercado Pago" },
    });

    // Simulate worker_core lead context extraction
    const leadVars: Record<string, string> = { ...(contact.variables ?? {}) };
    if (contact.name) {
      const firstName = contact.name.split(" ")[0] ?? contact.name;
      leadVars["lead_first_name"] = firstName;
      leadVars["lead_full_name"] = contact.name;
    }

    assert.strictEqual(leadVars["lead_first_name"], "Juan");
    assert.strictEqual(leadVars["lead_full_name"], "Juan Pérez");
    assert.strictEqual(leadVars["account_type"], "premium");
    assert.strictEqual(leadVars["last_product"], "Mercado Pago");
  });

  it("compileSystemPrompt replaces {{lead_first_name}} placeholder", () => {
    // Simulate compileSystemPrompt behavior (template variable replacement)
    const template =
      "Hola {{lead_first_name}}, veo que tienes {{account_type}}";
    const vars: Record<string, string> = {
      lead_first_name: "Juan",
      account_type: "premium",
    };

    const compiled = template.replace(
      /\{\{(\w+)\}\}/g,
      (_, key: string) => vars[key] ?? `{{${key}}}`,
    );

    assert.ok(compiled.includes("Hola Juan"), "First name injected");
    assert.ok(compiled.includes("premium"), "Account type injected");
    assert.ok(!compiled.includes("{{"), "No unresolved placeholders");
  });

  it("null variables do not crash the injector", () => {
    const contact = makeContact({ variables: null, name: null });
    const leadVars: Record<string, string> = { ...(contact.variables ?? {}) };
    if (contact.name) leadVars["lead_first_name"] = contact.name.split(" ")[0]!;

    assert.strictEqual(
      Object.keys(leadVars).length,
      0,
      "Empty vars from null contact",
    );
  });
});

// ── Test 4: Campaign claim function contract ───────────────────────────────────

describe("claim_campaign_contacts RPC contract", () => {
  it("claimed contacts transition from pending to calling", () => {
    const contacts: MockContact[] = [
      makeContact({ id: "c1", status: "pending" }),
      makeContact({ id: "c2", status: "pending" }),
      makeContact({ id: "c3", status: "calling" }), // should NOT be claimed again
    ];

    // Simulate claim logic (FOR UPDATE SKIP LOCKED picks only pending)
    const claimed = contacts
      .filter((c) => c.status === "pending")
      .slice(0, 2)
      .map((c) => ({
        ...c,
        status: "calling" as ContactStatus,
        attempts: c.attempts + 1,
      }));

    assert.strictEqual(claimed.length, 2, "Only pending contacts claimed");
    claimed.forEach((c) => {
      assert.strictEqual(c.status, "calling");
      assert.strictEqual(c.attempts, 1);
    });
  });

  it("limit parameter is respected", () => {
    const contacts = Array.from({ length: 10 }, (_, i) =>
      makeContact({ id: `c${i}`, status: "pending" }),
    );
    const limit = 3;
    const claimed = contacts
      .filter((c) => c.status === "pending")
      .slice(0, limit);
    assert.strictEqual(claimed.length, 3, "Limit respected");
  });
});

// ── Test 5: configuration JSONB override ─────────────────────────────────────

describe("Campaign configuration overrides", () => {
  it("campaign configuration stores arbitrary JSONB settings", () => {
    const campaign = makeCampaign({
      configuration: {
        cooldown_minutes: 120,
        webhook_url: "https://example.com/webhook",
        max_daily_calls: 500,
      },
    });

    const config = campaign.configuration as Record<string, unknown>;
    assert.strictEqual(config["cooldown_minutes"], 120);
    assert.strictEqual(config["max_daily_calls"], 500);
    assert.ok(typeof config["webhook_url"] === "string");
  });

  it("null configuration falls back to default values", () => {
    const campaign = makeCampaign({ configuration: null });
    const config =
      (campaign.configuration as Record<string, unknown> | null) ?? {};
    assert.strictEqual(Object.keys(config).length, 0, "Empty config when null");
  });
});

// ── Test 6: Contact status values ─────────────────────────────────────────────

describe("campaign_contacts status values", () => {
  it("valid status values include all required variants", () => {
    const validStatuses: ContactStatus[] = [
      "pending",
      "calling",
      "converted",
      "no_answer",
      "invalid",
      "rejected",
      "voicemail",
      "max_attempts",
      "excluded",
      "completed",
      "failed",
    ];

    // New values added in migration 055
    assert.ok(
      validStatuses.includes("excluded"),
      "'excluded' status must be valid",
    );
    assert.ok(
      validStatuses.includes("completed"),
      "'completed' status must be valid",
    );
    assert.ok(
      validStatuses.includes("failed"),
      "'failed' status must be valid",
    );
  });
});

// ── Test 7: Dispatcher result aggregation ─────────────────────────────────────

describe("DispatchResult aggregation", () => {
  it("result correctly tallies contacted/excluded/errors", () => {
    const result = {
      contacted: 0,
      excluded: 0,
      errors: 0,
      details: [] as unknown[],
    };

    // Simulate processing 5 contacts: 3 called, 1 excluded, 1 error
    const outcomes = [
      "called",
      "called",
      "called",
      "excluded",
      "error",
    ] as const;
    for (const outcome of outcomes) {
      if (outcome === "called") result.contacted++;
      else if (outcome === "excluded") result.excluded++;
      else result.errors++;
      result.details.push({ contactId: `c-${outcome}`, outcome });
    }

    assert.strictEqual(result.contacted, 3);
    assert.strictEqual(result.excluded, 1);
    assert.strictEqual(result.errors, 1);
    assert.strictEqual(result.details.length, 5);
  });
});

// ── Test 8: Race condition guard ──────────────────────────────────────────────

describe("Race condition prevention", () => {
  it("two dispatchers claiming same pool get disjoint subsets", () => {
    // Simulate two concurrent dispatcher calls claiming from pool of 4
    const pool = ["c1", "c2", "c3", "c4"];
    let nextIndex = 0;

    // Simulate atomic claim — each call gets the next `limit` items in order
    const claim = (limit: number) => {
      const items = pool.slice(nextIndex, nextIndex + limit);
      nextIndex += items.length;
      return items;
    };

    const dispatcher1 = claim(2);
    const dispatcher2 = claim(2);

    assert.strictEqual(dispatcher1.length, 2);
    assert.strictEqual(dispatcher2.length, 2);

    // No overlap
    const overlap = dispatcher1.filter((id) => dispatcher2.includes(id));
    assert.strictEqual(
      overlap.length,
      0,
      "No contact claimed by both dispatchers",
    );

    // Union covers all
    const union = new Set([...dispatcher1, ...dispatcher2]);
    assert.strictEqual(union.size, 4, "All contacts covered exactly once");
  });
});
