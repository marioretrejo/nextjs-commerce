/**
 * Tests for lib/compliance/dial-eligibility.ts
 *
 * Uses Supabase client stubs — no real DB or network calls.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  checkDialEligibility,
  recordDialEligibilityCheck,
  isWithinAllowedDialingHours,
  REASON_CODES,
  type DialEligibilityInput,
} from "../../lib/compliance/dial-eligibility.js";

// ── Supabase stub builder ─────────────────────────────────────────────────────

type QueryResult<T> = { data: T | null; error: null };

interface StubQueryBuilder {
  select: (..._: unknown[]) => StubQueryBuilder;
  eq: (..._: unknown[]) => StubQueryBuilder;
  or: (..._: unknown[]) => StubQueryBuilder;
  in: (..._: unknown[]) => StubQueryBuilder;
  gte: (..._: unknown[]) => StubQueryBuilder;
  limit: (..._: unknown[]) => StubQueryBuilder;
  maybeSingle: () => Promise<QueryResult<unknown>>;
  single: () => Promise<QueryResult<unknown>>;
  insert: (..._: unknown[]) => Promise<{ error: null }>;
  update: (..._: unknown[]) => StubQueryBuilder;
}

function makeQueryBuilder(result: unknown): StubQueryBuilder {
  const b: StubQueryBuilder = {
    select: () => b,
    eq: () => b,
    or: () => b,
    in: () => b,
    gte: () => b,
    limit: () => b,
    update: () => b,
    maybeSingle: async () => ({ data: result, error: null }),
    single: async () => ({ data: result, error: null }),
    insert: async () => ({ error: null }),
  };
  return b;
}

type TableName = string;

function makeSupabaseStub(
  tableResponses: Record<TableName, unknown>,
): DialEligibilityInput["supabase"] {
  return {
    from: (table: string) => makeQueryBuilder(tableResponses[table] ?? null),
  } as unknown as DialEligibilityInput["supabase"];
}

// Default "happy path" table responses (all checks pass)
function defaultResponses(): Record<string, unknown> {
  return {
    workspaces: {
      id: "ws-1",
      is_suspended: false,
      overage_blocked: false,
      minutes_used: 10,
      minutes_limit: 1000,
    },
    dnc_entries: null,
    dnc_list: null,
    calls: null,
    campaign_contacts: { attempts: 0 },
    campaigns: {
      status: "active",
      max_retries: 3,
      retry_interval_hours: 4,
      retry_enabled: true,
    },
    compliance_settings: {
      calling_hours_enabled: false,
      calling_hours_start: "09:00",
      calling_hours_end: "18:00",
      calling_days: ["mon", "tue", "wed", "thu", "fri"],
    },
  };
}

const VALID_PHONE = "+12025551234";
const WORKSPACE_ID = "ws-1";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("checkDialEligibility", () => {
  it("returns allowed=true when all checks pass", async () => {
    const result = await checkDialEligibility({
      workspaceId: WORKSPACE_ID,
      phoneNumber: VALID_PHONE,
      supabase: makeSupabaseStub(defaultResponses()),
    });
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.reason_code, null);
    assert.ok(result.normalized_phone, "Should return normalized phone");
  });

  it("blocks invalid_phone_number for non-E.164 input", async () => {
    const result = await checkDialEligibility({
      workspaceId: WORKSPACE_ID,
      phoneNumber: "not-a-phone",
      supabase: makeSupabaseStub(defaultResponses()),
    });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason_code, REASON_CODES.INVALID_PHONE);
  });

  it("blocks workspace_suspended when workspace is suspended", async () => {
    const responses = {
      ...defaultResponses(),
      workspaces: {
        id: "ws-1",
        is_suspended: true,
        overage_blocked: false,
        minutes_used: 0,
        minutes_limit: 1000,
      },
    };
    const result = await checkDialEligibility({
      workspaceId: WORKSPACE_ID,
      phoneNumber: VALID_PHONE,
      supabase: makeSupabaseStub(responses),
    });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason_code, REASON_CODES.WORKSPACE_SUSPENDED);
  });

  it("blocks insufficient_balance when minutes_used >= minutes_limit", async () => {
    const responses = {
      ...defaultResponses(),
      workspaces: {
        id: "ws-1",
        is_suspended: false,
        overage_blocked: false,
        minutes_used: 1000,
        minutes_limit: 1000,
      },
    };
    const result = await checkDialEligibility({
      workspaceId: WORKSPACE_ID,
      phoneNumber: VALID_PHONE,
      supabase: makeSupabaseStub(responses),
    });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason_code, REASON_CODES.INSUFFICIENT_BALANCE);
  });

  it("blocks campaign_paused when campaign status is paused", async () => {
    const responses = {
      ...defaultResponses(),
      campaigns: {
        status: "paused",
        max_retries: 3,
        retry_interval_hours: 4,
        retry_enabled: true,
      },
    };
    const result = await checkDialEligibility({
      workspaceId: WORKSPACE_ID,
      campaignId: "campaign-1",
      phoneNumber: VALID_PHONE,
      supabase: makeSupabaseStub(responses),
    });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason_code, REASON_CODES.CAMPAIGN_PAUSED);
  });

  it("blocks campaign_inactive when campaign is completed", async () => {
    const responses = {
      ...defaultResponses(),
      campaigns: {
        status: "completed",
        max_retries: 3,
        retry_interval_hours: 4,
        retry_enabled: true,
      },
    };
    const result = await checkDialEligibility({
      workspaceId: WORKSPACE_ID,
      campaignId: "campaign-1",
      phoneNumber: VALID_PHONE,
      supabase: makeSupabaseStub(responses),
    });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason_code, REASON_CODES.CAMPAIGN_INACTIVE);
  });

  it("blocks dnc when phone is in dnc_entries", async () => {
    // We need a custom stub that returns a DNC entry for dnc_entries
    const responses = defaultResponses();

    const customStub = {
      from: (table: string) => {
        if (table === "dnc_entries") {
          return makeQueryBuilder({ id: "dnc-row-1" });
        }
        return makeQueryBuilder(responses[table] ?? null);
      },
    } as unknown as DialEligibilityInput["supabase"];

    const result = await checkDialEligibility({
      workspaceId: WORKSPACE_ID,
      phoneNumber: VALID_PHONE,
      supabase: customStub,
    });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason_code, REASON_CODES.DNC);
  });

  it("blocks opt_out when prior call has business_outcome=dnc", async () => {
    const responses = defaultResponses();

    const customStub = {
      from: (table: string) => {
        if (table === "calls") {
          return makeQueryBuilder({ id: "call-opt-out" });
        }
        return makeQueryBuilder(responses[table] ?? null);
      },
    } as unknown as DialEligibilityInput["supabase"];

    const result = await checkDialEligibility({
      workspaceId: WORKSPACE_ID,
      phoneNumber: VALID_PHONE,
      supabase: customStub,
    });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason_code, REASON_CODES.OPT_OUT);
  });

  it("blocks max_retries_exceeded when attempts >= max_retries", async () => {
    const responses = {
      ...defaultResponses(),
      campaign_contacts: { attempts: 3 },
      campaigns: {
        status: "active",
        max_retries: 3,
        retry_interval_hours: 4,
        retry_enabled: true,
      },
    };
    const result = await checkDialEligibility({
      workspaceId: WORKSPACE_ID,
      campaignId: "campaign-1",
      leadId: "contact-1",
      phoneNumber: VALID_PHONE,
      supabase: makeSupabaseStub(responses),
    });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason_code, REASON_CODES.MAX_RETRIES);
  });

  it("blocks cooldown_active when called within cooldown window", async () => {
    const responses = defaultResponses();

    // The 'calls' table is queried twice:
    // 1st call (opt-out check): must return null so we don't block on opt_out
    // 2nd call (cooldown check): must return a recent call
    let callsQueryCount = 0;
    const customStub = {
      from: (table: string) => {
        if (table === "calls") {
          callsQueryCount++;
          if (callsQueryCount === 1) {
            // opt-out check — no opt-out found
            return makeQueryBuilder(null);
          }
          // cooldown check — recent call found
          return makeQueryBuilder({
            id: "recent-call",
            created_at: new Date().toISOString(),
          });
        }
        return makeQueryBuilder(responses[table] ?? null);
      },
    } as unknown as DialEligibilityInput["supabase"];

    const result = await checkDialEligibility({
      workspaceId: WORKSPACE_ID,
      phoneNumber: VALID_PHONE,
      supabase: customStub,
    });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason_code, REASON_CODES.COOLDOWN);
  });

  it("blocks outside_allowed_hours when calling hours are enabled and now is outside window", async () => {
    const responses = {
      ...defaultResponses(),
      // Saturday at calling hours enabled — still blocked because calling_days doesn't include sat
      compliance_settings: {
        calling_hours_enabled: true,
        calling_hours_start: "09:00",
        calling_hours_end: "18:00",
        calling_days: ["mon", "tue", "wed", "thu", "fri"],
      },
    };

    // Use a Saturday timestamp (2024-01-06 is a Saturday)
    const saturday = new Date("2024-01-06T14:00:00Z");

    const result = await checkDialEligibility({
      workspaceId: WORKSPACE_ID,
      phoneNumber: VALID_PHONE,
      timezone: "UTC",
      now: saturday,
      supabase: makeSupabaseStub(responses),
    });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason_code, REASON_CODES.OUTSIDE_HOURS);
  });

  it("does not block outside_allowed_hours when calling_hours_enabled=false", async () => {
    const responses = {
      ...defaultResponses(),
      compliance_settings: {
        calling_hours_enabled: false,
        calling_hours_start: "09:00",
        calling_hours_end: "10:00",
        calling_days: ["mon"],
      },
    };

    // Sunday midnight — would be blocked if hours were enabled
    const sunday = new Date("2024-01-07T00:30:00Z");

    const result = await checkDialEligibility({
      workspaceId: WORKSPACE_ID,
      phoneNumber: VALID_PHONE,
      timezone: "UTC",
      now: sunday,
      supabase: makeSupabaseStub(responses),
    });
    assert.strictEqual(result.allowed, true);
  });

  it("blocks workspace_not_found when workspace query returns null", async () => {
    const responses = { ...defaultResponses(), workspaces: null };
    const result = await checkDialEligibility({
      workspaceId: "nonexistent",
      phoneNumber: VALID_PHONE,
      supabase: makeSupabaseStub(responses),
    });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason_code, REASON_CODES.WORKSPACE_NOT_FOUND);
  });
});

// ── recordDialEligibilityCheck ────────────────────────────────────────────────

describe("recordDialEligibilityCheck", () => {
  it("does not throw when Supabase insert returns an error", async () => {
    const brokenStub = {
      from: () => ({
        insert: async () => ({ error: { message: "DB is down" } }),
      }),
    } as unknown as DialEligibilityInput["supabase"];

    await assert.doesNotReject(
      recordDialEligibilityCheck(
        { allowed: false, reason: "test", reason_code: "test", checks: {} },
        { workspaceId: "ws-1", phoneNumber: "+12025551234" },
        brokenStub,
      ),
    );
  });

  it("does not throw when Supabase insert throws", async () => {
    const throwingStub = {
      from: () => ({
        insert: async () => {
          throw new Error("connection refused");
        },
      }),
    } as unknown as DialEligibilityInput["supabase"];

    await assert.doesNotReject(
      recordDialEligibilityCheck(
        { allowed: true, reason: null, reason_code: null, checks: {} },
        { workspaceId: "ws-1", phoneNumber: "+12025551234" },
        throwingStub,
      ),
    );
  });
});

// ── isWithinAllowedDialingHours ───────────────────────────────────────────────

describe("isWithinAllowedDialingHours", () => {
  it("returns true during weekday business hours in UTC", () => {
    // Monday 10:00 UTC
    const monday10am = new Date("2024-01-08T10:00:00Z");
    assert.strictEqual(
      isWithinAllowedDialingHours({
        timezone: "UTC",
        now: monday10am,
        startHHMM: "09:00",
        endHHMM: "18:00",
        days: ["mon", "tue", "wed", "thu", "fri"],
      }),
      true,
    );
  });

  it("returns false before start time", () => {
    // Monday 08:59 UTC
    const monday8am = new Date("2024-01-08T08:59:00Z");
    assert.strictEqual(
      isWithinAllowedDialingHours({
        timezone: "UTC",
        now: monday8am,
        startHHMM: "09:00",
        endHHMM: "18:00",
        days: ["mon", "tue", "wed", "thu", "fri"],
      }),
      false,
    );
  });

  it("returns false after end time", () => {
    // Monday 18:01 UTC
    const monday6pm = new Date("2024-01-08T18:01:00Z");
    assert.strictEqual(
      isWithinAllowedDialingHours({
        timezone: "UTC",
        now: monday6pm,
        startHHMM: "09:00",
        endHHMM: "18:00",
        days: ["mon", "tue", "wed", "thu", "fri"],
      }),
      false,
    );
  });

  it("returns false on weekend when days excludes sat/sun", () => {
    // Saturday 12:00 UTC
    const saturday = new Date("2024-01-06T12:00:00Z");
    assert.strictEqual(
      isWithinAllowedDialingHours({
        timezone: "UTC",
        now: saturday,
        startHHMM: "09:00",
        endHHMM: "18:00",
        days: ["mon", "tue", "wed", "thu", "fri"],
      }),
      false,
    );
  });

  it("returns true on Saturday when sat is in days list", () => {
    // Saturday 12:00 UTC
    const saturday = new Date("2024-01-06T12:00:00Z");
    assert.strictEqual(
      isWithinAllowedDialingHours({
        timezone: "UTC",
        now: saturday,
        startHHMM: "09:00",
        endHHMM: "18:00",
        days: ["mon", "tue", "wed", "thu", "fri", "sat"],
      }),
      true,
    );
  });

  it("returns false for invalid timezone without throwing", () => {
    const result = isWithinAllowedDialingHours({
      timezone: "Not/A/Real/Timezone",
      now: new Date(),
      startHHMM: "09:00",
      endHHMM: "18:00",
      days: ["mon", "tue", "wed", "thu", "fri"],
    });
    assert.strictEqual(typeof result, "boolean");
  });
});
