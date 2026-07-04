/**
 * Unit tests for the unified account-state derivation (lib/account-state.ts).
 * This is the billing/conversion path — the banner and header pill must agree.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAccountState, accountStateNeedsBanner } from "@/lib/account-state";

describe("getAccountState", () => {
  it("FREE plan with minutes remaining is trial_active (not inactive)", () => {
    // The reported conversion bug: $0 balance + 50 min left must NOT be inactive.
    assert.strictEqual(
      getAccountState({
        plan: "free",
        minutes_used: 0,
        minutes_limit: 50,
        stripe_balance_cents: 0,
      }),
      "trial_active",
    );
  });

  it("FREE plan with all minutes used is trial_exhausted", () => {
    assert.strictEqual(
      getAccountState({
        plan: "free",
        minutes_used: 50,
        minutes_limit: 50,
        stripe_balance_cents: 0,
      }),
      "trial_exhausted",
    );
  });

  it("suspension wins over everything", () => {
    assert.strictEqual(
      getAccountState({
        plan: "pro",
        minutes_used: 0,
        minutes_limit: 1000,
        is_suspended: true,
      }),
      "suspended",
    );
    assert.strictEqual(
      getAccountState({
        plan: "pro",
        minutes_limit: 1000,
        billing_status: "suspended_for_nonpayment",
      }),
      "suspended",
    );
  });

  it("paid plan is active with prepaid balance even at 0 minutes left", () => {
    assert.strictEqual(
      getAccountState({
        plan: "pro",
        minutes_used: 1000,
        minutes_limit: 1000,
        stripe_balance_cents: 500,
      }),
      "paid_active",
    );
  });

  it("paid plan with no balance and no minutes is inactive", () => {
    assert.strictEqual(
      getAccountState({
        plan: "pro",
        minutes_used: 1000,
        minutes_limit: 1000,
        stripe_balance_cents: 0,
      }),
      "inactive",
    );
  });

  it("enterprise (minute_cap) is active while under cap, inactive when over", () => {
    assert.strictEqual(
      getAccountState({
        plan: "scale",
        minute_cap: 10000,
        minutes_used: 500,
        minutes_limit: 10000,
      }),
      "paid_active",
    );
    assert.strictEqual(
      getAccountState({
        plan: "scale",
        minute_cap: 10000,
        minutes_used: 10000,
        minutes_limit: 10000,
      }),
      "inactive",
    );
  });

  it("string minute values are coerced", () => {
    assert.strictEqual(
      getAccountState({
        plan: "free",
        minutes_used: "10",
        minutes_limit: "50",
      }),
      "trial_active",
    );
  });
});

describe("accountStateNeedsBanner", () => {
  it("shows a banner for trial/inactive states, not for paid_active/suspended", () => {
    assert.strictEqual(accountStateNeedsBanner("trial_active"), true);
    assert.strictEqual(accountStateNeedsBanner("trial_exhausted"), true);
    assert.strictEqual(accountStateNeedsBanner("inactive"), true);
    assert.strictEqual(accountStateNeedsBanner("paid_active"), false);
    assert.strictEqual(accountStateNeedsBanner("suspended"), false);
  });
});
