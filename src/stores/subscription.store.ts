// 전역 상태 관리 로직: src/stores/subscription.store.ts
import { create } from 'zustand';
import { UserSubscription } from '../types';
import { buildFreeSubscription, subscriptionService } from '../services/subscription.service';

interface SubscriptionStore {
  subscription: UserSubscription | null;
  isPro: boolean;
  isLoading: boolean;
  fetchSubscription: (userId: string) => Promise<void>;
  setProForDev: (userId: string, enabled: boolean) => Promise<void>;
  reset: () => void;
}

export const useSubscriptionStore = create<SubscriptionStore>((set) => ({
  subscription: null,
  isPro: false,
  isLoading: false,

  fetchSubscription: async (userId) => {
    set({ isLoading: true });
    try {
      const subscription = await subscriptionService.fetchMine(userId);
      set({
        subscription,
        isPro: subscriptionService.isProActive(subscription),
      });
    } catch (error) {
      console.warn('[SubscriptionStore] 구독 조회에 실패했습니다.', error);
      set({
        subscription: buildFreeSubscription(userId),
        isPro: false,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  setProForDev: async (userId, enabled) => {
    const subscription = await subscriptionService.upsertDevPro(userId, enabled);
    set({
      subscription,
      isPro: subscriptionService.isProActive(subscription),
    });
  },

  reset: () => set({
    subscription: null,
    isPro: false,
    isLoading: false,
  }),
}));
