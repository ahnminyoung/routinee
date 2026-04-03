-- ================================================================
-- Routinee - 기본 카테고리 시드 데이터
-- (신규 사용자 가입 시 Edge Function에서 호출)
-- ================================================================

-- 이 함수는 신규 사용자에게 기본 카테고리를 생성합니다.
CREATE OR REPLACE FUNCTION seed_default_categories(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- 할일 카테고리
  INSERT INTO categories (user_id, name, type, color, icon, is_default, sort_order) VALUES
    (p_user_id, '업무',      'todo',    '#6366F1', 'briefcase',    TRUE, 0),
    (p_user_id, '개인',      'todo',    '#EC4899', 'user',         TRUE, 1),
    (p_user_id, '건강',      'todo',    '#10B981', 'heart',        TRUE, 2),
    (p_user_id, '쇼핑',      'todo',    '#F59E0B', 'shopping-bag', TRUE, 3),
    (p_user_id, '여행',      'todo',    '#3B82F6', 'map-pin',      TRUE, 4),
    (p_user_id, '학습',      'todo',    '#8B5CF6', 'book-open',    TRUE, 5);

  -- 지출 카테고리
  INSERT INTO categories (user_id, name, type, color, icon, is_default, sort_order) VALUES
    (p_user_id, '식비',      'expense', '#EF4444', 'utensils',     TRUE, 0),
    (p_user_id, '교통',      'expense', '#F59E0B', 'car',          TRUE, 1),
    (p_user_id, '쇼핑',      'expense', '#EC4899', 'shopping-cart',TRUE, 2),
    (p_user_id, '문화/여가', 'expense', '#8B5CF6', 'film',         TRUE, 3),
    (p_user_id, '의료',      'expense', '#10B981', 'activity',     TRUE, 4),
    (p_user_id, '통신',      'expense', '#06B6D4', 'smartphone',   TRUE, 5),
    (p_user_id, '주거',      'expense', '#6366F1', 'home',         TRUE, 6),
    (p_user_id, '교육',      'expense', '#F97316', 'graduation-cap',TRUE,7),
    (p_user_id, '카페',      'expense', '#92400E', 'coffee',       TRUE, 8),
    (p_user_id, '기타',      'expense', '#6B7280', 'more-horizontal',TRUE,9);

  -- 수입 카테고리
  INSERT INTO categories (user_id, name, type, color, icon, is_default, sort_order) VALUES
    (p_user_id, '급여',      'income',  '#10B981', 'dollar-sign',  TRUE, 0),
    (p_user_id, '부업',      'income',  '#3B82F6', 'trending-up',  TRUE, 1),
    (p_user_id, '투자',      'income',  '#8B5CF6', 'bar-chart-2',  TRUE, 2),
    (p_user_id, '선물',      'income',  '#EC4899', 'gift',         TRUE, 3),
    (p_user_id, '기타',      'income',  '#6B7280', 'plus-circle',  TRUE, 4);

  -- 기본 자산 생성 (현금)
  INSERT INTO assets (user_id, name, type, color, icon, initial_balance, current_balance, sort_order) VALUES
    (p_user_id, '현금', 'cash', '#10B981', 'banknote', 0, 0, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 신규 사용자 가입 시 기본 카테고리 자동 생성 트리거
CREATE OR REPLACE FUNCTION handle_new_user_seed()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_default_categories(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- user_profiles 생성 후 카테고리 시드 실행
CREATE TRIGGER on_user_profile_created
  AFTER INSERT ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_seed();
