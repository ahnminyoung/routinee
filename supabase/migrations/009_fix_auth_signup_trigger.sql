-- ================================================================
-- Routinee - Fix Auth Signup Trigger (handle_new_user)
-- ================================================================

BEGIN;

-- 기존 트리거 제거 후 재생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

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
    email = EXCLUDED.email,
    display_name = COALESCE(public.user_profiles.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(public.user_profiles.avatar_url, EXCLUDED.avatar_url);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 기존 auth.users 중 profile 누락 사용자 보정
INSERT INTO public.user_profiles (id, display_name, avatar_url, email)
SELECT
  au.id,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name',
    SPLIT_PART(au.email, '@', 1)
  ) AS display_name,
  au.raw_user_meta_data->>'avatar_url' AS avatar_url,
  au.email
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.id = au.id
WHERE up.id IS NULL
  AND au.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

COMMIT;
