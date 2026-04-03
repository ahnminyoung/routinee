import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="categories" />
      <Stack.Screen name="budgets" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="finance-sharing" />
    </Stack>
  );
}
