import { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import '../src/globals.css';
import { useAuthStore } from '../src/stores/auth.store';
import { useUIStore } from '../src/stores/ui.store';
import { supabase } from '../src/services/supabase';
import { useRealtime } from '../src/hooks/useRealtime';
import {
  initNotifications,
  ensureNotificationPermissions,
  registerPushTokenForUser,
} from '../src/services/notification.service';

// 글로벌 FAB 액션 선택 모달
function AddActionModal() {
  const { isAddModalOpen, addModalType, openAddModal, closeAddModal } = useUIStore();

  const handleSelectTodo = () => {
    closeAddModal();
    router.push('/modals/add-todo');
  };
  const handleSelectTransaction = () => {
    closeAddModal();
    router.push('/modals/add-transaction');
  };

  return (
    <Modal visible={isAddModalOpen} animationType="fade" transparent onRequestClose={closeAddModal}>
      <TouchableOpacity
        className="flex-1 bg-black/50 justify-end"
        activeOpacity={1}
        onPress={closeAddModal}
      >
        <View className="bg-white dark:bg-surface-dark rounded-t-3xl p-6 pb-10">
          <Text className="text-lg font-bold text-text-primary dark:text-text-dark-primary text-center mb-5">
            무엇을 추가할까요?
          </Text>
          <View className="gap-y-3">
            <TouchableOpacity
              className="flex-row items-center bg-surface-secondary dark:bg-surface-dark-secondary rounded-2xl p-4"
              onPress={handleSelectTodo}
              activeOpacity={0.8}
            >
              <View className="w-12 h-12 bg-primary/10 rounded-2xl items-center justify-center mr-4">
                <Text className="text-2xl">✅</Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-text-primary dark:text-text-dark-primary">
                  할일 추가
                </Text>
                <Text className="text-sm text-text-secondary mt-0.5">
                  새로운 할일을 만들어 보세요
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center bg-surface-secondary dark:bg-surface-dark-secondary rounded-2xl p-4"
              onPress={handleSelectTransaction}
              activeOpacity={0.8}
            >
              <View className="w-12 h-12 bg-income/10 rounded-2xl items-center justify-center mr-4">
                <Text className="text-2xl">💰</Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-text-primary dark:text-text-dark-primary">
                  거래 추가
                </Text>
                <Text className="text-sm text-text-secondary mt-0.5">
                  수입 또는 지출을 기록하세요
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function InAppNoticeOverlay() {
  const { inAppNotice, clearInAppNotice } = useUIStore();
  const insets = useSafeAreaInsets();

  if (!inAppNotice) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 12,
        right: 12,
        zIndex: 999,
      }}
    >
      <TouchableOpacity
        onPress={clearInAppNotice}
        activeOpacity={0.9}
        className="rounded-2xl bg-surface-dark px-4 py-3 border border-border-dark"
      >
        <Text className="text-sm font-bold text-white">{inAppNotice.title}</Text>
        <Text className="text-xs text-text-dark-secondary mt-1">{inAppNotice.message}</Text>
      </TouchableOpacity>
    </View>
  );
}

function AppContent() {
  const { setSession, fetchProfile, user } = useAuthStore();

  // 리얼타임 구독 (인증된 사용자에게만)
  useRealtime(user?.id);

  useEffect(() => {
    void initNotifications();
    void ensureNotificationPermissions();

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        if (session?.user) {
          void fetchProfile(session.user.id);
        }
      })
      .catch((error) => {
        console.warn('[Auth] 세션 초기화 중 오류가 발생했습니다.', error);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session?.user) {
          void fetchProfile(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void registerPushTokenForUser(user.id);
  }, [user?.id]);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="modals/add-todo"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="modals/add-transaction"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="modals/add-asset"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="modals/report-export"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
      <AddActionModal />
      <InAppNoticeOverlay />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <AppContent />
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
