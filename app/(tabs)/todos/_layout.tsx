// 앱 화면/라우팅 로직: app/(tabs)/todos/_layout.tsx
import { Stack } from 'expo-router';

export default function TodosLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
