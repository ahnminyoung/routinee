// 앱 화면/라우팅 로직: app/(tabs)/settings/_layout.tsx
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* 설정 하위 화면 라우팅 등록 */}
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="categories" />
      <Stack.Screen name="budgets" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="finance-sharing" />
      <Stack.Screen name="subscription" />
      {/* 오프라인 큐/운영 로그 진단 화면 */}
      <Stack.Screen name="ops" />
    </Stack>
  );
}
