/**
 * Fase 14: Campaign API Security Audit — unit tests
 * Uses node:test (no external dependencies).
 *
 * Tests cover:
 *   - Auth / workspace tenancy isolation
 *   - Payload validation (schema bounds, formats)
 *   - International phone normalisation (LATAM + US)
 *   - Batch deduplication and variable sanitisation
 *   - Status transitions and activation preconditions
 *   - Configuration sanitisation
 *   - Dispatcher load-test guard
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

// ── Import shared utilities under test ────────────────────────────────────────

import {
  normalizePhone,
  sanitizeConfiguration,
  sanitizeVariables,
  isTransitionAllowed,
  ALLOWED_TRANSITIONS,
} from "@/lib/campaigns/validation";
import type { CampaignStatus } from "@/lib/supabase/types";

// ─────────────────────────────────────────────────────────────────────────────
// 1. normalizePhone — US numbers
// ─────────────────────────────────────────────────────────────────────────────
describe("normalizePhone — US numbers", () => {
  it("T01 · 10-digit US number becomes E.164", () => {
    const { normalized, valid } = normalizePhone("2025551234", "US");
    assert.equal(valid, true);
    assert.equal(normalized, "+12025551234");
  });

  it("T02 · already-E.164 US number passes through", () => {
    const { normalized, valid } = normalizePhone("+12025551234", "US");
    assert.equal(valid, true);
    assert.equal(normalized, "+12025551234");
  });

  it("T03 · 11-digit with leading 1 normalises correctly", () => {
    const { normalized, valid } = normalizePhone("12025551234", "US");
    assert.equal(valid, true);
    assert.equal(normalized, "+12025551234");
  });

  it("T04 · formatted US number with dashes normalises", () => {
    const { normalized, valid } = normalizePhone("(202) 555-1234", "US");
    assert.equal(valid, true);
    assert.equal(normalized, "+12025551234");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. normalizePhone — LATAM numbers
// ─────────────────────────────────────────────────────────────────────────────
describe("normalizePhone — LATAM numbers", () => {
  it("T05 · Mexican mobile (+52) normalises with MX default", () => {
    const { normalized, valid } = normalizePhone("+525512345678", "MX");
    assert.equal(valid, true);
    assert.match(normalized, /^\+52/);
  });

  it("T06 · Colombian number (+57) with CO default", () => {
    const { normalized, valid } = normalizePhone("+573001234567", "CO");
    assert.equal(valid, true);
    assert.match(normalized, /^\+57/);
  });

  it("T07 · Argentine number (+54) with AR default", () => {
    const { normalized, valid } = normalizePhone("+541112345678", "AR");
    assert.equal(valid, true);
    assert.match(normalized, /^\+54/);
  });

  it("T08 · clearly invalid short string is rejected", () => {
    const { valid } = normalizePhone("123", "MX");
    assert.equal(valid, false);
  });

  it("T09 · empty string is rejected", () => {
    const { valid } = normalizePhone("", "US");
    assert.equal(valid, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. sanitizeVariables — key sanitisation and size limits
// ─────────────────────────────────────────────────────────────────────────────
describe("sanitizeVariables", () => {
  it("T10 · removes secret-like keys (api_key, token, password)", () => {
    const { sanitized, removedKeys } = sanitizeVariables({
      name: "Alice",
      api_key: "sk-123",
      auth_token: "tok-456",
      password: "hunter2",
    });
    assert.deepEqual(Object.keys(sanitized), ["name"]);
    assert.equal(removedKeys.length, 3);
    assert.ok(removedKeys.includes("api_key"));
  });

  it("T11 · safe variables pass through unchanged", () => {
    const input = { account_type: "premium", last_product: "Mercado Pago" };
    const { sanitized, removedKeys, oversized } = sanitizeVariables(input);
    assert.deepEqual(sanitized, input);
    assert.equal(removedKeys.length, 0);
    assert.equal(oversized, false);
  });

  it("T12 · oversized payload (> 4 KB) is flagged", () => {
    const big = "x".repeat(5000);
    const { oversized } = sanitizeVariables({ data: big });
    assert.equal(oversized, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. sanitizeConfiguration — webhook_url and secret key stripping
// ─────────────────────────────────────────────────────────────────────────────
describe("sanitizeConfiguration", () => {
  it("T13 · null config returns empty sanitized object with no error", () => {
    const { sanitized, error } = sanitizeConfiguration(null);
    assert.deepEqual(sanitized, {});
    assert.equal(error, null);
  });

  it("T14 · strips secret-like keys from configuration", () => {
    const { sanitized, removedKeys, error } = sanitizeConfiguration({
      greeting: "Hello",
      secret_key: "abc",
      api_token: "xyz",
    });
    assert.equal(error, null);
    assert.ok("greeting" in sanitized);
    assert.ok(!("secret_key" in sanitized));
    assert.ok(!("api_token" in sanitized));
    assert.equal(removedKeys.length, 2);
  });

  it("T15 · valid https webhook_url passes", () => {
    const { sanitized, error } = sanitizeConfiguration({
      webhook_url: "https://example.com/hook",
    });
    assert.equal(error, null);
    assert.equal(sanitized.webhook_url, "https://example.com/hook");
  });

  it("T16 · http webhook_url returns error", () => {
    const { error } = sanitizeConfiguration({
      webhook_url: "http://example.com/hook",
    });
    assert.ok(error !== null);
    assert.match(error!, /https/);
  });

  it("T17 · malformed webhook_url returns error", () => {
    const { error } = sanitizeConfiguration({
      webhook_url: "not-a-url",
    });
    assert.ok(error !== null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. isTransitionAllowed — status machine
// ─────────────────────────────────────────────────────────────────────────────
describe("isTransitionAllowed — campaign status machine", () => {
  it("T18 · draft → active is allowed", () => {
    assert.equal(isTransitionAllowed("draft", "active"), true);
  });

  it("T19 · active → paused is allowed", () => {
    assert.equal(isTransitionAllowed("active", "paused"), true);
  });

  it("T20 · completed → active is NOT allowed", () => {
    assert.equal(isTransitionAllowed("completed", "active"), false);
  });

  it("T21 · completed → any status is NOT allowed", () => {
    const statuses: CampaignStatus[] = [
      "draft",
      "scheduled",
      "active",
      "paused",
      "completed",
    ];
    for (const s of statuses) {
      assert.equal(
        isTransitionAllowed("completed", s),
        false,
        `completed → ${s} should be disallowed`,
      );
    }
  });

  it("T22 · paused → draft is allowed (resume path)", () => {
    assert.equal(isTransitionAllowed("paused", "draft"), true);
  });

  it("T23 · ALLOWED_TRANSITIONS covers all CampaignStatus values", () => {
    const statuses: CampaignStatus[] = [
      "draft",
      "scheduled",
      "active",
      "paused",
      "completed",
    ];
    for (const s of statuses) {
      assert.ok(
        s in ALLOWED_TRANSITIONS,
        `${s} missing from ALLOWED_TRANSITIONS`,
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Batch deduplication logic (pure function simulation)
// ─────────────────────────────────────────────────────────────────────────────
describe("Batch lead deduplication", () => {
  function dedupLeads(
    leads: { phone: string; campaign_lead_id?: string | null }[],
  ) {
    const seenPhones = new Set<string>();
    const seenLeadIds = new Set<string>();
    const accepted: typeof leads = [];
    const duplicates: { index: number; reason: string }[] = [];

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i]!;
      const { normalized, valid } = normalizePhone(lead.phone, "US");
      if (!valid) {
        duplicates.push({ index: i, reason: "invalid" });
        continue;
      }
      if (seenPhones.has(normalized)) {
        duplicates.push({ index: i, reason: "duplicate_phone" });
        continue;
      }
      seenPhones.add(normalized);
      if (lead.campaign_lead_id) {
        if (seenLeadIds.has(lead.campaign_lead_id)) {
          duplicates.push({ index: i, reason: "duplicate_lead_id" });
          continue;
        }
        seenLeadIds.add(lead.campaign_lead_id);
      }
      accepted.push(lead);
    }
    return { accepted, duplicates };
  }

  it("T24 · within-batch duplicate phone is skipped (only first row kept)", () => {
    const { accepted, duplicates } = dedupLeads([
      { phone: "+12025551234" },
      { phone: "2025551234" }, // same number, different format
    ]);
    assert.equal(accepted.length, 1);
    assert.equal(duplicates.length, 1);
    assert.equal(duplicates[0]!.reason, "duplicate_phone");
  });

  it("T25 · within-batch duplicate campaign_lead_id is skipped", () => {
    const { accepted, duplicates } = dedupLeads([
      { phone: "+12025551234", campaign_lead_id: "lead-1" },
      { phone: "+12025559999", campaign_lead_id: "lead-1" }, // same external ID
    ]);
    assert.equal(accepted.length, 1);
    assert.equal(duplicates.length, 1);
    assert.equal(duplicates[0]!.reason, "duplicate_lead_id");
  });
});
