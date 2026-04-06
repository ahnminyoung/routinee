-- 기존 assets 전체 정책 제거 (FOR ALL)
DROP POLICY IF EXISTS "users_own_assets" ON assets;

-- 쓰기 정책: 본인만 (INSERT/UPDATE/DELETE)
CREATE POLICY "users_insert_own_assets" ON assets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_assets" ON assets
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_assets" ON assets
  FOR DELETE USING (auth.uid() = user_id);

-- 읽기 정책: 본인 자산 + share_finance=true인 연결 상대방 자산
CREATE POLICY "users_read_assets" ON assets
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.share_finance = TRUE
        AND (
          (c.user_a_id = auth.uid() AND c.user_b_id = assets.user_id)
          OR (c.user_b_id = auth.uid() AND c.user_a_id = assets.user_id)
        )
    )
  );
