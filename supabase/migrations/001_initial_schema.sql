-- ================================================================
-- Routinee - Initial Schema
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- CATEGORIES (할일/수입/지출 카테고리)
-- ================================================================
CREATE TABLE IF NOT EXISTS categories (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('todo', 'income', 'expense', 'both')),
  color        TEXT NOT NULL DEFAULT '#6B7280',
  icon         TEXT NOT NULL DEFAULT 'tag',
  is_default   BOOLEAN DEFAULT FALSE,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);

-- ================================================================
-- TODOS (할일)
-- ================================================================
CREATE TABLE IF NOT EXISTS todos (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  description          TEXT,
  category_id          UUID REFERENCES categories(id) ON DELETE SET NULL,
  priority             TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  status               TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  due_date             DATE,
  due_time             TIME,
  completed_at         TIMESTAMPTZ,
  sort_order           INTEGER DEFAULT 0,
  -- 반복 할일
  is_recurring         BOOLEAN DEFAULT FALSE,
  recurrence_rule      TEXT,
  recurrence_parent_id UUID REFERENCES todos(id) ON DELETE CASCADE,
  -- 가계부 연동
  linked_transaction_id UUID,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_todos_user_due
  ON todos(user_id, due_date) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_todos_user_status
  ON todos(user_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_todos_parent
  ON todos(recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL;

-- ================================================================
-- ASSETS (자산: 은행계좌, 신용카드, 현금)
-- ================================================================
CREATE TABLE IF NOT EXISTS assets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('bank_account', 'credit_card', 'cash', 'investment', 'loan')),
  institution     TEXT,
  color           TEXT DEFAULT '#3B82F6',
  icon            TEXT DEFAULT 'wallet',
  initial_balance BIGINT DEFAULT 0,
  current_balance BIGINT DEFAULT 0,
  credit_limit    BIGINT,
  sort_order      INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- ================================================================
-- TRANSACTIONS (수입/지출/이체 기록)
-- ================================================================
CREATE TABLE IF NOT EXISTS transactions (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                 TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount               BIGINT NOT NULL CHECK (amount > 0),
  description          TEXT NOT NULL,
  memo                 TEXT,
  category_id          UUID REFERENCES categories(id) ON DELETE SET NULL,
  asset_id             UUID REFERENCES assets(id) ON DELETE SET NULL,
  to_asset_id          UUID REFERENCES assets(id) ON DELETE SET NULL,
  transaction_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_time     TIME,
  -- 영수증
  receipt_url          TEXT,
  receipt_ocr_data     JSONB,
  -- 반복 거래
  is_recurring         BOOLEAN DEFAULT FALSE,
  recurrence_rule      TEXT,
  recurrence_parent_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  -- 할일 연동
  linked_todo_id       UUID REFERENCES todos(id) ON DELETE SET NULL,
  sort_order           INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON transactions(user_id, transaction_date) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_type
  ON transactions(user_id, type) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_asset
  ON transactions(asset_id) WHERE deleted_at IS NULL AND asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_category
  ON transactions(category_id) WHERE deleted_at IS NULL AND category_id IS NOT NULL;

-- ================================================================
-- BUDGETS (예산)
-- ================================================================
CREATE TABLE IF NOT EXISTS budgets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES categories(id) ON DELETE CASCADE,
  amount          BIGINT NOT NULL CHECK (amount > 0),
  period          TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'yearly')),
  month           INTEGER CHECK (month BETWEEN 1 AND 12),
  year            INTEGER,
  alert_threshold INTEGER DEFAULT 80 CHECK (alert_threshold BETWEEN 0 AND 100),
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- SAVINGS GOALS (저축 목표 - Post-MVP용, 스키마만 포함)
-- ================================================================
CREATE TABLE IF NOT EXISTS savings_goals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  target_amount   BIGINT NOT NULL CHECK (target_amount > 0),
  current_amount  BIGINT DEFAULT 0,
  target_date     DATE,
  asset_id        UUID REFERENCES assets(id) ON DELETE SET NULL,
  icon            TEXT DEFAULT 'piggy-bank',
  color           TEXT DEFAULT '#10B981',
  is_completed    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- USER PROFILES (사용자 프로필)
-- ================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name          TEXT,
  avatar_url            TEXT,
  currency              TEXT DEFAULT 'KRW',
  locale                TEXT DEFAULT 'ko-KR',
  theme                 TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  week_start_day        INTEGER DEFAULT 1 CHECK (week_start_day IN (0, 1)),
  push_token            TEXT,
  biometric_enabled     BOOLEAN DEFAULT FALSE,
  onboarding_completed  BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
