-- Add Stripe billing fields to workspaces so each workspace tracks its own subscription
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id        text,
  ADD COLUMN IF NOT EXISTS subscription_status    text NOT NULL DEFAULT 'trialing';

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_stripe_customer ON public.workspaces(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_stripe_sub ON public.workspaces(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
