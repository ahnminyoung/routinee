// API/도메인 서비스 로직: src/services/auth.service.ts
import {
  supabase,
  isSupabaseConfigured,
  supabaseConfigErrorMessage,
} from './supabase';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

const ensureSupabaseConfigured = () => {
  if (!isSupabaseConfigured) {
    throw new Error(supabaseConfigErrorMessage);
  }
};

export const authService = {
  /**
   * 이메일/비밀번호 로그인
   */
  signInWithEmail: async (email: string, password: string) => {
    ensureSupabaseConfigured();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  /**
   * 이메일/비밀번호 회원가입
   */
  signUpWithEmail: async (email: string, password: string, displayName?: string) => {
    ensureSupabaseConfigured();
    const emailRedirectTo = Linking.createURL('/auth/callback');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: displayName },
        emailRedirectTo,
      },
    });
    if (error) throw error;
    return data;
  },

  /**
   * 회원가입 인증 메일 재발송
   */
  resendSignUpVerification: async (email: string) => {
    ensureSupabaseConfigured();
    const emailRedirectTo = Linking.createURL('/auth/callback');
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo },
    });
    if (error) throw error;
    return data;
  },

  /**
   * Google OAuth 로그인
   */
  signInWithGoogle: async () => {
    ensureSupabaseConfigured();
    const redirectUri = makeRedirectUri({ scheme: 'routinee', path: 'auth/callback' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;

    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      if (result.type === 'success') {
        const { url } = result;
        await supabase.auth.exchangeCodeForSession(url);
      }
    }
  },

  /**
   * Apple 로그인 (Phase 5에서 구현)
   */
  signInWithApple: async () => {
    // expo-apple-authentication 사용
    // Phase 5에서 구현
    throw new Error('Apple 로그인은 곧 지원 예정입니다.');
  },

  /**
   * Kakao 로그인 (Phase 5에서 구현)
   */
  signInWithKakao: async () => {
    // expo-web-browser + Kakao OAuth
    // Phase 5에서 구현
    throw new Error('카카오 로그인은 곧 지원 예정입니다.');
  },

  /**
   * 로그아웃
   */
  signOut: async () => {
    ensureSupabaseConfigured();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * 비밀번호 재설정 이메일 발송
   */
  resetPassword: async (email: string) => {
    ensureSupabaseConfigured();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'routinee://reset-password',
    });
    if (error) throw error;
  },

  /**
   * 현재 세션 가져오기
   */
  getSession: async () => {
    ensureSupabaseConfigured();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /**
   * 현재 사용자 가져오기
   */
  getUser: async () => {
    ensureSupabaseConfigured();
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },
};
