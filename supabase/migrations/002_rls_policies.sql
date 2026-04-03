-- ================================================================
-- Routinee - Row Level Security Policies
-- ================================================================

-- RLS 활성화
ALTER TABLE categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles   ENABLE ROW LEVEL SECURITY;

-- categories: 자신의 데이터만 접근
CREATE POLICY "users_own_categories" ON categories
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- todos: 자신의 데이터만 접근
CREATE POLICY "users_own_todos" ON todos
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- assets: 자신의 데이터만 접근
CREATE POLICY "users_own_assets" ON assets
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- transactions: 자신의 데이터만 접근
CREATE POLICY "users_own_transactions" ON transactions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- budgets: 자신의 데이터만 접근
CREATE POLICY "users_own_budgets" ON budgets
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- savings_goals: 자신의 데이터만 접근
CREATE POLICY "users_own_savings_goals" ON savings_goals
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_profiles: 자신의 프로필만 접근
CREATE POLICY "users_own_profile" ON user_profiles
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Realtime 구독을 위한 publication 설정
-- (Supabase 대시보드에서 해당 테이블들을 Realtime에 추가해야 함)
