-- ================================================================
-- Routinee - Todo Features + Sharing
-- ================================================================

BEGIN;

-- ----------------------------------------------------------------
-- user_profiles: 이메일 컬럼 추가 (초대/연결용)
-- ----------------------------------------------------------------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE public.user_profiles up
SET email = au.email
FROM auth.users au
WHERE up.id = au.id
  AND (up.email IS NULL OR up.email = '');

ALTER TABLE public.user_profiles
  ALTER COLUMN email SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_email_unique'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_email_unique UNIQUE (email);
  END IF;
END $$;

-- 신규 가입 트리거 함수에 email도 함께 반영
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
  SET
    display_name = COALESCE(public.user_profiles.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(public.user_profiles.avatar_url, EXCLUDED.avatar_url),
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------
-- 공유 연결 테이블 (양방향 1건)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connections (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CHECK (user_a_id <> user_b_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'connections_user_pair_unique'
  ) THEN
    ALTER TABLE public.connections
      ADD CONSTRAINT connections_user_pair_unique UNIQUE (user_a_id, user_b_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_connections_user_a ON public.connections(user_a_id);
CREATE INDEX IF NOT EXISTS idx_connections_user_b ON public.connections(user_b_id);

-- ----------------------------------------------------------------
-- todos 확장 컬럼
-- ----------------------------------------------------------------
ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_lunar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS save_as_memo BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_anniversary BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS label_color TEXT DEFAULT '#10B981',
  ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS d_day_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS link_url TEXT,
  ADD COLUMN IF NOT EXISTS memo TEXT,
  ADD COLUMN IF NOT EXISTS checklist_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 기존 데이터 초기화 보정
UPDATE public.todos
SET is_all_day = TRUE
WHERE is_all_day IS NULL;

UPDATE public.todos
SET reminder_minutes = 10
WHERE reminder_minutes IS NULL;

UPDATE public.todos
SET label_color = '#10B981'
WHERE label_color IS NULL OR label_color = '';

UPDATE public.todos
SET checklist_json = '[]'::jsonb
WHERE checklist_json IS NULL;

-- ----------------------------------------------------------------
-- 할일 참여자 테이블 (공유 대상 사용자)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.todo_participants (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  todo_id    UUID NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'todo_participants_unique_member'
  ) THEN
    ALTER TABLE public.todo_participants
      ADD CONSTRAINT todo_participants_unique_member UNIQUE (todo_id, user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_todo_participants_todo_id ON public.todo_participants(todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_participants_user_id ON public.todo_participants(user_id);

-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_participants ENABLE ROW LEVEL SECURITY;

-- 기존 todos ALL 정책을 공유 정책으로 교체
DROP POLICY IF EXISTS users_own_todos ON public.todos;
DROP POLICY IF EXISTS users_select_visible_todos ON public.todos;
DROP POLICY IF EXISTS users_insert_own_todos ON public.todos;
DROP POLICY IF EXISTS users_update_own_todos ON public.todos;
DROP POLICY IF EXISTS users_delete_own_todos ON public.todos;

CREATE POLICY users_select_visible_todos ON public.todos
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.todo_participants tp
      WHERE tp.todo_id = todos.id
        AND tp.user_id = auth.uid()
    )
  );

CREATE POLICY users_insert_own_todos ON public.todos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY users_update_own_todos ON public.todos
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY users_delete_own_todos ON public.todos
  FOR DELETE
  USING (auth.uid() = user_id);

-- 연결 정책
DROP POLICY IF EXISTS users_select_connections ON public.connections;
DROP POLICY IF EXISTS users_insert_connections ON public.connections;
DROP POLICY IF EXISTS users_delete_connections ON public.connections;

CREATE POLICY users_select_connections ON public.connections
  FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY users_insert_connections ON public.connections
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND (auth.uid() = user_a_id OR auth.uid() = user_b_id)
  );

CREATE POLICY users_delete_connections ON public.connections
  FOR DELETE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- 참여자 정책
DROP POLICY IF EXISTS users_select_todo_participants ON public.todo_participants;
DROP POLICY IF EXISTS owners_insert_todo_participants ON public.todo_participants;
DROP POLICY IF EXISTS owners_delete_todo_participants ON public.todo_participants;

CREATE POLICY users_select_todo_participants ON public.todo_participants
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = added_by
  );

CREATE POLICY owners_insert_todo_participants ON public.todo_participants
  FOR INSERT
  WITH CHECK (
    auth.uid() = added_by
    AND EXISTS (
      SELECT 1
      FROM public.todos t
      WHERE t.id = todo_participants.todo_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY owners_delete_todo_participants ON public.todo_participants
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.todos t
      WHERE t.id = todo_participants.todo_id
        AND t.user_id = auth.uid()
    )
  );

-- 초대용 사용자 검색 허용
DROP POLICY IF EXISTS users_discover_profiles_for_invite ON public.user_profiles;

CREATE POLICY users_discover_profiles_for_invite ON public.user_profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');

COMMIT;
