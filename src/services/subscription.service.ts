// API/도메인 서비스 로직: src/services/subscription.service.ts
import { supabase } from './supabase';
import {
  CreateUserSubscriptionDto,
  UserSubscription,
} from '../types';
import { isMissingTableError, toUserFacingSupabaseError } from './supabase-error';

const db = supabase as any;

function nowIso() {
  return new Date().toISOString();
}

function daysFromNowIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function buildFreeSubscription(userId: string): UserSubscription {
  const now = nowIso();
  return {
    id: '00000000-0000-0000-0000-000000000000',
    user_id: userId,
    plan: 'free',
    status: 'inactive',
    provider: 'manual',
    provider_customer_id: null,
    provider_subscription_id: null,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    metadata: {},
    created_at: now,
    updated_at: now,
  };
}

export const subscriptionService = {
  fetchMine: async (userId: string): Promise<UserSubscription> => {
    const { data, error } = await db
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) return buildFreeSubscription(userId);
      throw toUserFacingSupabaseError(error, '구독');
    }

    return data ?? buildFreeSubscription(userId);
  },

  upsertDevPro: async (userId: string, enabled: boolean): Promise<UserSubscription> => {
    const payload: CreateUserSubscriptionDto = enabled
      ? {
          user_id: userId,
          plan: 'pro',
          status: 'active',
          provider: 'manual',
          provider_customer_id: null,
          provider_subscription_id: null,
          current_period_start: nowIso(),
          current_period_end: daysFromNowIso(30),
          cancel_at_period_end: false,
          metadata: { source: 'dev_toggle' },
        }
      : {
          user_id: userId,
          plan: 'free',
          status: 'inactive',
          provider: 'manual',
          provider_customer_id: null,
          provider_subscription_id: null,
          current_period_start: null,
          current_period_end: null,
          cancel_at_period_end: false,
          metadata: { source: 'dev_toggle' },
        };

    const { data, error } = await db
      .from('user_subscriptions')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) {
        throw new Error('구독 테이블이 없습니다. 최신 Supabase migration을 먼저 실행해주세요.');
      }
      throw toUserFacingSupabaseError(error, '구독');
    }

    if (!data) return buildFreeSubscription(userId);
    return data;
  },

  isProActive: (subscription: UserSubscription | null | undefined): boolean => {
    if (!subscription) return false;
    if (subscription.plan !== 'pro') return false;
    if (!['active', 'trialing', 'past_due'].includes(subscription.status)) return false;

    if (!subscription.current_period_end) return true;
    return new Date(subscription.current_period_end).getTime() >= Date.now();
  },
};
