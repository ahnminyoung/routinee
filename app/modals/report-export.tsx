import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ReportExportModal() {
  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      <View className="items-center pt-3 pb-1">
        <View className="w-10 h-1 bg-border dark:bg-border-dark rounded-full" />
      </View>
      <View className="flex-row items-center px-5 py-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-primary">닫기</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold text-text-primary dark:text-text-dark-primary">
          리포트 내보내기
        </Text>
        <View className="w-10" />
      </View>

      <View className="flex-1 items-center justify-center">
        <Text className="text-4xl mb-4">📊</Text>
        <Text className="text-text-secondary text-base">준비 중입니다</Text>
        <Text className="text-text-secondary text-sm mt-2">Phase 3에서 구현 예정</Text>
      </View>
    </SafeAreaView>
  );
}
