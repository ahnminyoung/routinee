import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function BillingReturnScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(tabs)/settings/subscription');
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-lg font-bold text-text-primary dark:text-text-dark-primary">
          결제 상태 확인 중...
        </Text>
        <Text className="text-sm text-text-secondary mt-2 text-center">
          잠시만 기다려주세요. 구독 화면으로 이동합니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}
