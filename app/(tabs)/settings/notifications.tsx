import { useState } from 'react';
import { View, Text, TouchableOpacity, Switch, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function NotificationsScreen() {
  const [todoAlerts, setTodoAlerts]     = useState(true);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [morningDigest, setMorning]     = useState(false);
  const [refreshing, setRefreshing]     = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      <View className="flex-row items-center px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Text className="text-2xl text-text-primary dark:text-text-dark-primary">←</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-xl font-bold text-text-primary dark:text-text-dark-primary">
          알림 설정
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View className="px-5 mt-2">
          <View className="bg-white dark:bg-surface-dark rounded-2xl overflow-hidden">
            <NotificationRow
              label="할일 마감 알림"
              description="마감일 전날 알림"
              emoji="⏰"
              value={todoAlerts}
              onChange={setTodoAlerts}
            />
            <NotificationRow
              label="예산 초과 경보"
              description="예산 80% 초과 시 알림"
              emoji="💸"
              value={budgetAlerts}
              onChange={setBudgetAlerts}
              isLast={true}
            />
          </View>

          <View className="bg-white dark:bg-surface-dark rounded-2xl overflow-hidden mt-4">
            <NotificationRow
              label="아침 요약"
              description="매일 오전 8시 오늘의 할일 요약"
              emoji="🌅"
              value={morningDigest}
              onChange={setMorning}
              isLast={true}
            />
          </View>

          <Text className="text-xs text-text-secondary text-center mt-6 px-4">
            알림은 디바이스 알림 설정에서도 관리할 수 있습니다.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function NotificationRow({ label, description, emoji, value, onChange, isLast }: {
  label: string;
  description: string;
  emoji: string;
  value: boolean;
  onChange: (v: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center px-4 py-4 ${!isLast ? 'border-b border-border dark:border-border-dark' : ''}`}
    >
      <Text className="text-xl mr-3">{emoji}</Text>
      <View className="flex-1 mr-3">
        <Text className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
          {label}
        </Text>
        <Text className="text-xs text-text-secondary mt-0.5">{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: '#6366F1' }}
      />
    </View>
  );
}
