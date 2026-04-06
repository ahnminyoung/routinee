// 커스텀 훅 로직: src/hooks/useAuth.ts
import { useAuthStore } from '../stores/auth.store';

/**
 * 인증 상태 및 액션을 편리하게 사용하는 훅
 */
export function useAuth() {
  const { user, session, profile, isLoading, fetchProfile, updateProfile, reset } = useAuthStore();

  return {
    user,
    session,
    profile,
    isLoading,
    isAuthenticated: !!session,
    fetchProfile,
    updateProfile,
    reset,
  };
}
