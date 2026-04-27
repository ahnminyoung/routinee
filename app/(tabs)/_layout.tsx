// 앱 화면/라우팅 로직: app/(tabs)/_layout.tsx
import { Tabs, Redirect } from 'expo-router';
import { View, Text } from 'react-native';
import { useAuthStore } from '../../src/stores/auth.store';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View className="items-center justify-center pt-1">
      <Text className={`text-xl ${focused ? 'opacity-100' : 'opacity-50'}`}>{emoji}</Text>
      <Text
        style={{ fontSize: 10, marginTop: 2 }}
        className={focused ? 'text-primary font-semibold' : 'text-text-secondary'}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { session } = useAuthStore();

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <Tabs
      initialRouteName="calendar"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 80,
          paddingBottom: 8,
          paddingTop: 4,
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          backgroundColor: '#FFFFFF',
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📅" label="캘린더" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="todos"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="✅" label="할일" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="💰" label="가계부" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" label="홈" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="⚙️" label="설정" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
