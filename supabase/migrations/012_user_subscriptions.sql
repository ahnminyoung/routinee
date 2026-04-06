-- ================================================================
-- Routinee - User Subscriptions (Pro Billing Foundation)
-- ================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'canceled', 'past_due', 'trialing')),
  provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual', 'stripe', 'app_store', 'play_store', 'revenuecat')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_user_subscriptions ON public.user_subscriptions;
CREATE TRIGGER set_updated_at_user_subscriptions
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_own_user_subscriptions ON public.user_subscriptions;
DROP POLICY IF EXISTS users_insert_own_user_subscriptions ON public.user_subscriptions;
DROP POLICY IF EXISTS users_update_own_user_subscriptions ON public.user_subscriptions;
DROP POLICY IF EXISTS users_own_user_subscriptions ON public.user_subscriptions;

CREATE POLICY users_select_own_user_subscriptions ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY users_insert_own_user_subscriptions ON public.user_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY users_update_own_user_subscriptions ON public.user_subscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMIT;
