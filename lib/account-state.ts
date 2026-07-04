/**
 * Single source of truth for a workspace's account state, so the activation
 * banner and the header minutes pill can never contradict each other (e.g. the
 * banner saying "inactive" while the header shows "50 min left").
 *
 * Pure and dependency-free — unit-tested in agent/tests/account-state.test.ts.
 */

export type AccountState =
  | "trial_active" // free plan, trial minutes remaining
  | "trial_exhausted" // free plan, trial minutes used up
  | "paid_active" // paid/enterprise with capacity (balance or minutes)
  | "suspended" // suspended (billing or manual)
  | "inactive"; // paid client with no balance and no minutes → must add credit

export interface AccountStateInput {
  plan?: string | null;
  minutes_used?: number | string | null;
  minutes_limit?: number | string | null;
  stripe_balance_cents?: number | null;
  /** Non-null marks an enterprise (minute-capped) workspace. */
  minute_cap?: number | null;
  billing_status?: string | null;
  is_suspended?: boolean | null;
}

export function getAccountState(ws: AccountStateInput): AccountState {
  if (ws.is_suspended || ws.billing_status === "suspended_for_nonpayment") {
    return "suspended";
  }

  const used = Number(ws.minutes_used ?? 0);
  const limit = Number(ws.minutes_limit ?? 0);
  const minutesRemaining = limit - used;
  const balanceCents = ws.stripe_balance_cents ?? 0;
  const isEnterprise = ws.minute_cap != null;
  const isFree = (ws.plan ?? "free") === "free";

  if (isEnterprise) {
    // Enterprise: capacity is the minute cap, not a prepaid balance.
    return minutesRemaining > 0 ? "paid_active" : "inactive";
  }

  if (isFree) {
    return minutesRemaining > 0 ? "trial_active" : "trial_exhausted";
  }

  // Paid plan (pro/scale): active while it has prepaid balance OR minutes left.
  if (balanceCents > 0 || minutesRemaining > 0) return "paid_active";
  return "inactive";
}

/** Whether any attention-grabbing banner should be shown for this state. */
export function accountStateNeedsBanner(state: AccountState): boolean {
  return (
    state === "trial_active" ||
    state === "trial_exhausted" ||
    state === "inactive"
  );
}
