-- 020: Enterprise quota + billing status + prepaid balance
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS minute_cap           integer     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS billing_status       text        NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS stripe_balance_cents integer     NOT NULL DEFAULT 0;

ALTER TABLE workspaces
  DROP CONSTRAINT IF EXISTS workspaces_billing_status_check;

ALTER TABLE workspaces
  ADD CONSTRAINT workspaces_billing_status_check
  CHECK (billing_status IN ('active', 'suspended_for_nonpayment'));

COMMENT ON COLUMN workspaces.minute_cap IS
  'Enterprise prepaid minute cap. NULL = standard client uses Stripe balance. Non-null = ignore Stripe.';
COMMENT ON COLUMN workspaces.billing_status IS
  'active | suspended_for_nonpayment. Set by superadmin for overdue accounts.';
COMMENT ON COLUMN workspaces.stripe_balance_cents IS
  'Prepaid top-up balance in USD cents for standard pay-as-you-go clients.';
