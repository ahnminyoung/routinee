// 앱 화면/라우팅 로직: app/(tabs)/finance/_layout.tsx
import { Stack } from 'expo-router';

export default function FinanceLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="assets" />
    </Stack>
  );
}
