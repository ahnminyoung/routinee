-- ================================================================
-- Routinee - Subscription Provider IDs for Stripe Integration
-- ================================================================

BEGIN;

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_provider_customer_id
  ON public.user_subscriptions(provider_customer_id)
  WHERE provider_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_provider_subscription_id
  ON public.user_subscriptions(provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

COMMIT;
