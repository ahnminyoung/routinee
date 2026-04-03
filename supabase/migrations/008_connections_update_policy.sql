-- ================================================================
-- Routinee - Connections Update Policy
-- ================================================================

BEGIN;

DROP POLICY IF EXISTS users_update_connections ON public.connections;

CREATE POLICY users_update_connections ON public.connections
  FOR UPDATE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id)
  WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

COMMIT;
