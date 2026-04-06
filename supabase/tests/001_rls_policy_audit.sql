-- ================================================================
-- Routinee - RLS Policy Audit (Smoke Test)
-- ================================================================
-- 목적:
-- 1) 주요 테이블의 RLS가 켜져 있는지 확인
-- 2) 정책이 누락되지 않았는지 메타데이터 레벨에서 점검
--
-- 실행 위치: Supabase SQL Editor (staging/prod 공통)
-- 주의: 본 스크립트는 정책 "존재"를 검증하는 빠른 스모크 테스트입니다.

DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- --------------------------------------------------------------
  -- RLS 활성화 확인
  -- --------------------------------------------------------------
  SELECT c.relrowsecurity
    INTO v_exists
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'assets';
  IF NOT COALESCE(v_exists, FALSE) THEN
    RAISE EXCEPTION 'RLS off: public.assets';
  END IF;

  SELECT c.relrowsecurity
    INTO v_exists
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'transactions';
  IF NOT COALESCE(v_exists, FALSE) THEN
    RAISE EXCEPTION 'RLS off: public.transactions';
  END IF;

  SELECT c.relrowsecurity
    INTO v_exists
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'user_subscriptions';
  IF NOT COALESCE(v_exists, FALSE) THEN
    RAISE EXCEPTION 'RLS off: public.user_subscriptions';
  END IF;

  -- --------------------------------------------------------------
  -- assets 정책 확인
  -- --------------------------------------------------------------
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assets'
      AND policyname = 'users_read_assets'
  ) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Missing policy: public.assets.users_read_assets';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assets'
      AND policyname = 'users_insert_own_assets'
  ) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Missing policy: public.assets.users_insert_own_assets';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assets'
      AND policyname = 'users_update_own_assets'
  ) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Missing policy: public.assets.users_update_own_assets';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assets'
      AND policyname = 'users_delete_own_assets'
  ) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Missing policy: public.assets.users_delete_own_assets';
  END IF;

  -- --------------------------------------------------------------
  -- transactions 정책 확인
  -- --------------------------------------------------------------
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transactions'
      AND policyname = 'users_select_visible_transactions'
  ) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Missing policy: public.transactions.users_select_visible_transactions';
  END IF;

  -- --------------------------------------------------------------
  -- user_subscriptions 정책 확인
  -- --------------------------------------------------------------
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_subscriptions'
      AND policyname = 'users_select_own_user_subscriptions'
  ) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Missing policy: public.user_subscriptions.users_select_own_user_subscriptions';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_subscriptions'
      AND policyname = 'users_insert_own_user_subscriptions'
  ) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Missing policy: public.user_subscriptions.users_insert_own_user_subscriptions';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_subscriptions'
      AND policyname = 'users_update_own_user_subscriptions'
  ) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Missing policy: public.user_subscriptions.users_update_own_user_subscriptions';
  END IF;

  RAISE NOTICE 'RLS policy audit passed.';
END $$;
