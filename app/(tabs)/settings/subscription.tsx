// 앱 화면/라우팅 로직: app/(tabs)/settings/subscription.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../../src/stores/auth.store';
import { useSubscriptionStore } from '../../../src/stores/subscription.store';
import { billingService } from '../../../src/services/billing.service';

function formatDateLabel(value: string | null | undefined) {
  if (!value) return '없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '없음';
  return date.toLocaleDateString('ko-KR');
}

export default function SubscriptionScreen() {
  const { user } = useAuthStore();
  const {
    subscription,
    isPro,
    isLoading,
    fetchSubscription,
    setProForDev,
  } = useSubscriptionStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAction, setLoadingAction] = useState<null | 'checkout' | 'portal' | 'dev'>(null);

  useEffect(() => {
    if (!user) return;
    void fetchSubscription(user.id);
  }, [user, fetchSubscription]);

  const planLabel = useMemo(() => (isPro ? 'Routinee Pro' : 'Free'), [isPro]);
  const periodEndLabel = formatDateLabel(subscription?.current_period_end);

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await fetchSubscription(user.id);
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleProForDev = async (enable: boolean) => {
    if (!user) return;
    setLoadingAction('dev');
    try {
      await setProForDev(user.id, enable);
      Alert.alert(
        enable ? 'Pro 활성화 완료' : 'Free 전환 완료',
        enable
          ? '개발용 결제 처리로 Pro 기능이 열렸습니다.'
          : '개발용 결제 해제로 Free 플랜으로 전환되었습니다.'
      );
    } catch (e: any) {
      Alert.alert('처리 실패', e?.message ?? '구독 상태 변경에 실패했습니다.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStripeCheckout = async () => {
    if (!user) return;
    setLoadingAction('checkout');
    try {
      const result = await billingService.startStripeCheckout();
      await fetchSubscription(user.id);

      if (result.type === 'success' && result.status === 'success') {
        Alert.alert('결제 완료', 'Routinee Pro 구독이 활성화되었습니다.');
        return;
      }
      if (result.type === 'success' && result.status === 'canceled') {
        Alert.alert('결제 취소', '결제가 취소되었습니다.');
        return;
      }
      if (result.type === 'cancel') {
        Alert.alert('결제 취소', '결제가 취소되었습니다.');
      }
    } catch (e: any) {
      Alert.alert(
        '결제 시작 실패',
        e?.message ?? 'Stripe 결제를 시작하지 못했습니다. Edge Function/Secret 설정을 확인해주세요.'
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const handleOpenStripePortal = async () => {
    if (!user) return;
    setLoadingAction('portal');
    try {
      await billingService.openStripePortal();
      await fetchSubscription(user.id);
    } catch (e: any) {
      Alert.alert(
        '구독 관리 실패',
        e?.message ?? 'Stripe 고객 포털을 열지 못했습니다. 구독 정보 동기화를 확인해주세요.'
      );
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      <View className="flex-row items-center px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Text className="text-2xl text-text-primary dark:text-text-dark-primary">←</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-xl font-bold text-text-primary dark:text-text-dark-primary">
          Routinee Pro
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View className={`rounded-2xl p-4 mb-4 ${isPro ? 'bg-primary' : 'bg-white dark:bg-surface-dark'}`}>
          <Text className={`${isPro ? 'text-white/80' : 'text-text-secondary'} text-xs`}>
            현재 플랜
          </Text>
          <Text className={`${isPro ? 'text-white' : 'text-text-primary dark:text-text-dark-primary'} text-2xl font-bold mt-1`}>
            {isLoading ? '불러오는 중...' : planLabel}
          </Text>
          <Text className={`${isPro ? 'text-white/85' : 'text-text-secondary'} text-xs mt-2`}>
            만료 예정일: {periodEndLabel}
          </Text>
        </View>

        <View className="bg-white dark:bg-surface-dark rounded-2xl p-4 mb-4">
          <Text className="text-sm font-semibold text-text-primary dark:text-text-dark-primary mb-3">
            Pro 기능
          </Text>
          <FeatureRow label="리포트 내보내기(CSV)" enabled={isPro} />
          <FeatureRow label="가계부 공유 멤버 무제한" enabled={isPro} />
          <FeatureRow label="앞으로 추가될 고급 분석 기능" enabled={isPro} isLast={true} />
        </View>

        <TouchableOpacity
          className={`rounded-2xl py-4 items-center ${loadingAction ? 'bg-primary/60' : 'bg-primary'}`}
          disabled={!!loadingAction || !user}
          onPress={isPro ? handleOpenStripePortal : handleStripeCheckout}
        >
          <Text className="text-white text-base font-semibold">
            {loadingAction
              ? '처리 중...'
              : isPro
                ? 'Stripe에서 구독 관리'
                : 'Stripe로 Pro 구독하기'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="mt-3 rounded-2xl py-4 items-center border border-border dark:border-border-dark"
          onPress={handleRefresh}
          disabled={!!loadingAction}
        >
          <Text className="text-text-primary dark:text-text-dark-primary font-semibold">
            결제 후 상태 새로고침
          </Text>
        </TouchableOpacity>

        <Text className="text-xs text-text-secondary mt-3 text-center">
          Stripe 결제 화면으로 이동합니다. 결제/취소 후 앱으로 돌아오면 상태를 동기화합니다.
        </Text>

        <TouchableOpacity
          className="mt-4 rounded-2xl py-4 items-center border border-border dark:border-border-dark"
          onPress={() => router.push('/modals/report-export')}
        >
          <Text className="text-text-primary dark:text-text-dark-primary font-semibold">
            리포트 내보내기 화면 열기
          </Text>
        </TouchableOpacity>

        <View className="bg-white dark:bg-surface-dark rounded-2xl p-4 mt-4">
          <Text className="text-xs text-text-secondary mb-2">
            개발용 빠른 테스트
          </Text>
          <TouchableOpacity
            className={`rounded-xl py-3 items-center ${loadingAction ? 'bg-primary/50' : 'bg-primary'}`}
            disabled={!!loadingAction || !user}
            onPress={() => handleToggleProForDev(!isPro)}
          >
            <Text className="text-white font-semibold">
              {isPro ? '개발용: Free 전환' : '개발용: Pro 즉시 활성화'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureRow({ label, enabled, isLast }: { label: string; enabled: boolean; isLast?: boolean }) {
  return (
    <View className={`flex-row items-center py-3 ${!isLast ? 'border-b border-border dark:border-border-dark' : ''}`}>
      <Text className="text-lg mr-2">{enabled ? '✅' : '🔒'}</Text>
      <Text className={`text-sm ${enabled ? 'text-text-primary dark:text-text-dark-primary' : 'text-text-secondary'}`}>
        {label}
      </Text>
    </View>
  );
}
