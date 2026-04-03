-- ================================================================
-- Routinee - Shared Finance via Connections
-- ================================================================

BEGIN;

-- 연결된 사용자와 가계부를 공유할지 여부
ALTER TABLE public.connections
  ADD COLUMN IF NOT EXISTS share_finance BOOLEAN NOT NULL DEFAULT TRUE;

-- ----------------------------------------------------------------
-- transactions RLS: SELECT는 본인 + finance 공유 연결 상대 허용
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS users_own_transactions ON public.transactions;
DROP POLICY IF EXISTS users_select_visible_transactions ON public.transactions;
DROP POLICY IF EXISTS users_insert_own_transactions ON public.transactions;
DROP POLICY IF EXISTS users_update_own_transactions ON public.transactions;
DROP POLICY IF EXISTS users_delete_own_transactions ON public.transactions;

CREATE POLICY users_select_visible_transactions ON public.transactions
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.connections c
      WHERE c.share_finance = TRUE
        AND (
          (c.user_a_id = auth.uid() AND c.user_b_id = transactions.user_id)
          OR
          (c.user_b_id = auth.uid() AND c.user_a_id = transactions.user_id)
        )
    )
  );

CREATE POLICY users_insert_own_transactions ON public.transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY users_update_own_transactions ON public.transactions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY users_delete_own_transactions ON public.transactions
  FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
