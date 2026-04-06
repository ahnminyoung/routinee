// 앱 화면/라우팅 로직: app/+not-found.tsx
import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '화면을 찾을 수 없습니다' }} />
      <View className="flex-1 items-center justify-center bg-surface-secondary dark:bg-black">
        <Text className="text-4xl mb-4">🔍</Text>
        <Text className="text-xl font-bold text-text-primary dark:text-text-dark-primary mb-2">
          화면을 찾을 수 없습니다
        </Text>
        <Link href="/" className="mt-4">
          <Text className="text-primary">홈으로 돌아가기</Text>
        </Link>
      </View>
    </>
  );
}
