import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../../src/stores/auth.store';
import { useSubscriptionStore } from '../../../src/stores/subscription.store';
import { authService } from '../../../src/services/auth.service';
import { getDisplayName } from '../../../src/utils/display-name';
import { useFinanceShareCount } from '../../../src/hooks/useFinanceShareCount';

interface SettingsItem {
  label: string;
  emoji: string;
  description?: string;
  onPress: () => void;
}

export default function SettingsScreen() {
  const { user, profile, reset, fetchProfile } = useAuthStore();
  const { isPro, subscription, fetchSubscription } = useSubscriptionStore();
  const { sharedCount } = useFinanceShareCount(user?.id);
  const [refreshing, setRefreshing] = useState(false);
  const displayName = getDisplayName(user, profile);

  useEffect(() => {
    if (!user) return;
    void fetchSubscription(user.id);
  }, [user, fetchSubscription]);

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await Promise.all([
        fetchProfile(user.id),
        fetchSubscription(user.id),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await authService.signOut();
          reset();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  const sections: { title: string; items: SettingsItem[] }[] = [
    {
      title: '계정',
      items: [
        {
          label: '프로필 수정',
          emoji: '👤',
          description: displayName,
          onPress: () => router.push('/(tabs)/settings/profile'),
        },
      ],
    },
    {
      title: '관리',
      items: [
        {
          label: '카테고리 관리',
          emoji: '🏷️',
          description: '할일 및 거래 카테고리 설정',
          onPress: () => router.push('/(tabs)/settings/categories'),
        },
        {
          label: '예산 관리',
          emoji: '💰',
          description: '월별 예산 설정',
          onPress: () => router.push('/(tabs)/settings/budgets'),
        },
        {
          label: '가계부 공유 멤버',
          emoji: '🤝',
          description: sharedCount > 0 ? `${sharedCount}명과 공유 중` : '공유 멤버 연결 및 설정',
          onPress: () => router.push('/(tabs)/settings/finance-sharing'),
        },
      ],
    },
    {
      title: '알림',
      items: [
        {
          label: '알림 설정',
          emoji: '🔔',
          description: '마감일 및 예산 알림',
          onPress: () => router.push('/(tabs)/settings/notifications'),
        },
      ],
    },
    {
      title: '프리미엄',
      items: [
        {
          label: 'Routinee Pro',
          emoji: '✨',
          description: isPro
            ? `활성화됨${subscription?.current_period_end ? ` · ${new Date(subscription.current_period_end).toLocaleDateString('ko-KR')}까지` : ''}`
            : '고급 리포트, 무제한 가계부 공유',
          onPress: () => router.push('/(tabs)/settings/subscription'),
        },
      ],
    },
    {
      title: '기타',
      items: [
        {
          label: '로그아웃',
          emoji: '🚪',
          onPress: handleSignOut,
        },
      ],
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-text-primary dark:text-text-dark-primary">
          설정
        </Text>
      </View>

      {/* 프로필 카드 */}
      <View className="mx-5 mb-5 bg-primary rounded-3xl p-5">
        <View className="w-14 h-14 bg-white/20 rounded-full items-center justify-center mb-3">
          <Text className="text-2xl">👤</Text>
        </View>
        <Text className="text-white text-xl font-bold">
          {displayName}
        </Text>
        <Text className="text-white/80 text-sm mt-1">
          {isPro ? 'Routinee Pro 회원' : 'Routinee 회원'}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {sections.map((section) => (
          <View key={section.title} className="mb-5">
            <Text className="text-xs font-medium text-text-secondary mb-2 px-1">
              {section.title}
            </Text>
            <View className="bg-white dark:bg-surface-dark rounded-2xl overflow-hidden">
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  className={`flex-row items-center px-4 py-4 ${
                    index < section.items.length - 1 ? 'border-b border-border dark:border-border-dark' : ''
                  }`}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <Text className="text-xl mr-3">{item.emoji}</Text>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
                      {item.label}
                    </Text>
                    {item.description && (
                      <Text className="text-xs text-text-secondary mt-0.5">
                        {item.description}
                      </Text>
                    )}
                  </View>
                  <Text className="text-text-secondary">›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <Text className="text-center text-xs text-text-secondary mt-4">
          Routinee v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
