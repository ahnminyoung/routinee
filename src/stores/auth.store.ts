// 전역 상태 관리 로직: src/stores/auth.store.ts
import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { UserProfile } from '../types';
import { supabase } from '../services/supabase';

const db = supabase as any;

const pickNonEmptyString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

const resolveDisplayNameFromUser = (user: User | null): string | null => {
  if (!user) return null;
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  return pickNonEmptyString(
    metadata.display_name,
    metadata.full_name,
    metadata.name,
    user.email?.split('@')[0]
  );
};

const buildFallbackProfile = (user: User, existingProfile: UserProfile | null): UserProfile => {
  const now = new Date().toISOString();
  const fallbackEmail = user.email ?? existingProfile?.email ?? `${user.id}@local.invalid`;
  return {
    id: user.id,
    email: fallbackEmail,
    display_name: resolveDisplayNameFromUser(user) ?? existingProfile?.display_name ?? null,
    avatar_url: existingProfile?.avatar_url ?? null,
    currency: existingProfile?.currency ?? 'KRW',
    locale: existingProfile?.locale ?? 'ko-KR',
    theme: existingProfile?.theme ?? 'system',
    week_start_day: existingProfile?.week_start_day ?? 1,
    push_token: existingProfile?.push_token ?? null,
    biometric_enabled: existingProfile?.biometric_enabled ?? false,
    onboarding_completed: existingProfile?.onboarding_completed ?? false,
    created_at: existingProfile?.created_at ?? now,
    updated_at: now,
  };
};

const mergeProfileUpdates = (
  user: User,
  existingProfile: UserProfile | null,
  updates: Partial<UserProfile>
): UserProfile => {
  const base = buildFallbackProfile(user, existingProfile);
  return {
    ...base,
    ...updates,
    id: user.id,
    updated_at: new Date().toISOString(),
  };
};

interface AuthStore {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  reset: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: false,
  isInitialized: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set((state) => {
    if (!session?.user) {
      return { session: null, user: null, profile: null };
    }
    const hasCurrentProfile = state.profile?.id === session.user.id ? state.profile : null;
    return {
      session,
      user: session.user,
      profile: buildFallbackProfile(session.user, hasCurrentProfile),
    };
  }),
  setProfile: (profile) => set({ profile }),

  fetchProfile: async (userId: string) => {
    const { user, profile } = get();
    const fallbackUser = user?.id === userId ? user : null;

    try {
      const { data, error } = await db
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        if (fallbackUser) {
          set({ profile: buildFallbackProfile(fallbackUser, profile) });
        }
        return;
      }

      if (data) {
        set({ profile: data });
        return;
      }

      if (fallbackUser) {
        set({ profile: buildFallbackProfile(fallbackUser, profile) });
      }
    } catch {
      if (fallbackUser) {
        set({ profile: buildFallbackProfile(fallbackUser, profile) });
      }
    }
  },

  updateProfile: async (updates: Partial<UserProfile>) => {
    const { user, profile } = get();
    if (!user) return;

    const displayName = pickNonEmptyString(updates.display_name);
    if (displayName) {
      const { data: authData, error: authError } = await supabase.auth.updateUser({
        data: { full_name: displayName },
      });
      if (!authError && authData?.user) {
        set({ user: authData.user });
      }
    }

    const profileEmail = user.email ?? profile?.email ?? `${user.id}@local.invalid`;
    try {
      const { data, error } = await db
        .from('user_profiles')
        .upsert({ id: user.id, email: profileEmail, ...updates }, { onConflict: 'id' })
        .select()
        .maybeSingle();

      if (error || !data) {
        set({ profile: mergeProfileUpdates(user, profile, updates) });
        return;
      }

      set({ profile: data });
    } catch {
      set({ profile: mergeProfileUpdates(user, profile, updates) });
    }
  },

  reset: () => set({
    user: null,
    session: null,
    profile: null,
    isLoading: false,
  }),
}));
