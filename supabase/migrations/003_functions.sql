-- ================================================================
-- Routinee - Database Functions & Triggers
-- ================================================================

-- ----------------------------------------------------------------
-- updated_at 자동 업데이트 트리거
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON savings_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------
-- 신규 사용자 가입 시 user_profile 자동 생성
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ----------------------------------------------------------------
-- 자산 잔액 재계산 함수
-- (거래 추가/수정/삭제 후 호출)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_asset_balance(p_asset_id UUID)
RETURNS VOID AS $$
DECLARE
  v_initial BIGINT;
  v_balance BIGINT;
BEGIN
  SELECT initial_balance INTO v_initial FROM assets WHERE id = p_asset_id;

  SELECT COALESCE(SUM(
    CASE
      WHEN type = 'income'   AND asset_id = p_asset_id THEN amount
      WHEN type = 'expense'  AND asset_id = p_asset_id THEN -amount
      WHEN type = 'transfer' AND asset_id = p_asset_id THEN -amount
      WHEN type = 'transfer' AND to_asset_id = p_asset_id THEN amount
      ELSE 0
    END
  ), 0) INTO v_balance
  FROM transactions
  WHERE deleted_at IS NULL
    AND (asset_id = p_asset_id OR to_asset_id = p_asset_id);

  UPDATE assets
  SET current_balance = v_initial + v_balance
  WHERE id = p_asset_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------
-- 거래 변경 시 자산 잔액 자동 재계산 트리거
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_recalculate_asset_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT 또는 UPDATE 시 관련 자산 재계산
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.asset_id IS NOT NULL THEN
      PERFORM recalculate_asset_balance(NEW.asset_id);
    END IF;
    IF NEW.to_asset_id IS NOT NULL THEN
      PERFORM recalculate_asset_balance(NEW.to_asset_id);
    END IF;
  END IF;

  -- DELETE 시 이전 자산 재계산
  IF TG_OP = 'DELETE' THEN
    IF OLD.asset_id IS NOT NULL THEN
      PERFORM recalculate_asset_balance(OLD.asset_id);
    END IF;
    IF OLD.to_asset_id IS NOT NULL THEN
      PERFORM recalculate_asset_balance(OLD.to_asset_id);
    END IF;
  END IF;

  -- UPDATE 시 이전 자산도 재계산 (자산 변경된 경우)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.asset_id IS NOT NULL AND OLD.asset_id != NEW.asset_id THEN
      PERFORM recalculate_asset_balance(OLD.asset_id);
    END IF;
    IF OLD.to_asset_id IS NOT NULL AND (NEW.to_asset_id IS NULL OR OLD.to_asset_id != NEW.to_asset_id) THEN
      PERFORM recalculate_asset_balance(OLD.to_asset_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_transaction_change
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_asset_balance();

-- ----------------------------------------------------------------
-- 월별 지출 합계 조회 함수
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_monthly_summary(
  p_user_id UUID,
  p_year    INTEGER,
  p_month   INTEGER
)
RETURNS TABLE(
  total_income  BIGINT,
  total_expense BIGINT,
  net_balance   BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS total_income,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense,
    COALESCE(SUM(CASE WHEN type = 'income'  THEN amount
                      WHEN type = 'expense' THEN -amount
                      ELSE 0 END), 0) AS net_balance
  FROM transactions
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND EXTRACT(YEAR  FROM transaction_date) = p_year
    AND EXTRACT(MONTH FROM transaction_date) = p_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------
-- 카테고리별 지출 합계 조회 함수
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_category_spending(
  p_user_id UUID,
  p_year    INTEGER,
  p_month   INTEGER
)
RETURNS TABLE(
  category_id   UUID,
  category_name TEXT,
  category_color TEXT,
  total_amount  BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.color,
    COALESCE(SUM(t.amount), 0) AS total_amount
  FROM categories c
  LEFT JOIN transactions t
    ON t.category_id = c.id
    AND t.user_id = p_user_id
    AND t.type = 'expense'
    AND t.deleted_at IS NULL
    AND EXTRACT(YEAR  FROM t.transaction_date) = p_year
    AND EXTRACT(MONTH FROM t.transaction_date) = p_month
  WHERE c.user_id = p_user_id
    AND c.deleted_at IS NULL
    AND c.type IN ('expense', 'both')
  GROUP BY c.id, c.name, c.color
  HAVING COALESCE(SUM(t.amount), 0) > 0
  ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
