// 앱 화면/라우팅 로직: app/(auth)/welcome.tsx
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      <View className="flex-1 items-center justify-center px-6">
        {/* 로고 */}
        <View className="w-20 h-20 bg-primary rounded-3xl items-center justify-center mb-6 shadow-lg">
          <Text className="text-4xl">✓</Text>
        </View>

        {/* 타이틀 */}
        <Text className="text-4xl font-bold text-text-primary dark:text-text-dark-primary text-center mb-3">
          Routinee
        </Text>
        <Text className="text-text-secondary dark:text-text-dark-secondary text-center text-base leading-6 mb-12">
          할일과 가계부를 하나로{'\n'}
          스마트한 개인 관리의 시작
        </Text>

        {/* 기능 소개 */}
        <View className="w-full gap-y-4 mb-12">
          <FeatureItem
            emoji="✅"
            title="할일 관리"
            desc="카테고리, 우선순위, 반복 할일 지원"
          />
          <FeatureItem
            emoji="💰"
            title="가계부 관리"
            desc="수입·지출 기록, 예산 설정, 자산 관리"
          />
          <FeatureItem
            emoji="🔗"
            title="통합 관리"
            desc="할일과 재정을 연결하여 한눈에 파악"
          />
          <FeatureItem
            emoji="📊"
            title="리포트"
            desc="시각적 차트와 월별 분석 리포트"
          />
        </View>
      </View>

      {/* 버튼 영역 */}
      <View className="px-6 pb-8 gap-y-3">
        <TouchableOpacity
          className="bg-primary py-4 rounded-2xl items-center"
          onPress={() => router.push('/(auth)/sign-up')}
          activeOpacity={0.8}
        >
          <Text className="text-white text-base font-semibold">시작하기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="border border-border dark:border-border-dark py-4 rounded-2xl items-center"
          onPress={() => router.push('/(auth)/sign-in')}
          activeOpacity={0.8}
        >
          <Text className="text-text-primary dark:text-text-dark-primary text-base font-semibold">
            로그인
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function FeatureItem({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <View className="flex-row items-center gap-x-4 bg-surface-secondary dark:bg-surface-dark-secondary rounded-2xl p-4">
      <Text className="text-2xl">{emoji}</Text>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
          {title}
        </Text>
        <Text className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
          {desc}
        </Text>
      </View>
    </View>
  );
}
