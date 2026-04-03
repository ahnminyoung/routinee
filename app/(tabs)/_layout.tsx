import { Tabs, Redirect } from 'expo-router';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../../src/stores/auth.store';
import { useUIStore } from '../../src/stores/ui.store';
import { router } from 'expo-router';

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

function FABTabButton({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.fabButton}
    >
      <View style={styles.fabInner}>
        <Text style={{ color: 'white', fontSize: 28, lineHeight: 32 }}>+</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  const { session } = useAuthStore();
  const { openAddModal } = useUIStore();

  // 미인증 시 로그인 화면으로
  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <Tabs
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
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" label="홈" focused={focused} />
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
      {/* 중앙 FAB 탭 */}
      <Tabs.Screen
        name="add"
        options={{
          tabBarButton: (props) => (
            <FABTabButton onPress={() => openAddModal('todo')}>
              {props.children}
            </FABTabButton>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
          },
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
        name="calendar"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📅" label="캘린더" focused={focused} />
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

const styles = StyleSheet.create({
  fabButton: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
