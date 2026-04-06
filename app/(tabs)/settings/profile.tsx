// 앱 화면/라우팅 로직: app/(tabs)/settings/profile.tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../../src/stores/auth.store';
import { getDisplayName } from '../../../src/utils/display-name';

export default function ProfileScreen() {
  const { user, profile, updateProfile, fetchProfile } = useAuthStore();
  const [name, setName]       = useState(getDisplayName(user, profile, ''));
  const [isSaving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setName(getDisplayName(user, profile, ''));
  }, [user, profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ display_name: name.trim() });
      Alert.alert('저장 완료', '프로필이 업데이트되었습니다.');
      router.back();
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await fetchProfile(user.id);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      <View className="flex-row items-center px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Text className="text-2xl text-text-primary dark:text-text-dark-primary">←</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-xl font-bold text-text-primary dark:text-text-dark-primary">
          프로필 수정
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View className="px-5 mt-4">
          <View className="bg-white dark:bg-surface-dark rounded-2xl p-4 mb-4">
            <Text className="text-xs font-medium text-text-secondary mb-2">이름</Text>
            <TextInput
              className="text-base text-text-primary dark:text-text-dark-primary"
              placeholder="이름을 입력하세요"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
            />
          </View>

          <TouchableOpacity
            className={`py-4 rounded-2xl items-center ${isSaving ? 'bg-primary/60' : 'bg-primary'}`}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text className="text-white text-base font-semibold">
              {isSaving ? '저장 중...' : '저장'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
