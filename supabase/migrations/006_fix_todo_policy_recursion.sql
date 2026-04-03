-- ================================================================
-- Routinee - Fix RLS recursion between todos and todo_participants
-- ================================================================

BEGIN;

DROP POLICY IF EXISTS users_select_todo_participants ON public.todo_participants;

CREATE POLICY users_select_todo_participants ON public.todo_participants
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = added_by
  );

COMMIT;
