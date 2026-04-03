import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Alert, Modal, TextInput, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCategoryStore } from '../../../src/stores/category.store';
import { useAuthStore } from '../../../src/stores/auth.store';
import { Category, CategoryType, CreateCategoryDto } from '../../../src/types';
import { CATEGORY_COLORS, CATEGORY_TYPE_LABELS } from '../../../src/utils/constants';

const CATEGORY_TYPES: CategoryType[] = ['todo', 'expense', 'income'];

export default function CategoriesScreen() {
  const { user } = useAuthStore();
  const { categories, fetchCategories, addCategory, deleteCategory } = useCategoryStore();
  const [selectedType, setSelectedType] = useState<CategoryType>('expense');
  const [showModal, setShowModal]       = useState(false);
  const [newName, setNewName]           = useState('');
  const [newColor, setNewColor]         = useState<string>(CATEGORY_COLORS[0]);
  const [isSaving, setSaving]           = useState(false);
  const [refreshing, setRefreshing]     = useState(false);

  const loadCategories = useCallback(async () => {
    if (!user) return;
    try {
      await fetchCategories(user.id);
    } catch (error) {
      console.warn('[CategoriesScreen] 카테고리 조회에 실패했습니다.', error);
    }
  }, [user, fetchCategories]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCategories();
    setRefreshing(false);
  };

  const filtered = categories.filter(c =>
    c.type === selectedType || c.type === 'both'
  );

  const handleAdd = async () => {
    if (!newName.trim()) {
      Alert.alert('입력 오류', '카테고리 이름을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const dto: CreateCategoryDto = {
        user_id: user!.id,
        name: newName.trim(),
        type: selectedType,
        color: newColor,
        icon: 'tag',
      };
      await addCategory(dto);
      setShowModal(false);
      setNewName('');
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (cat: Category) => {
    if (cat.is_default) {
      Alert.alert('삭제 불가', '기본 카테고리는 삭제할 수 없습니다.');
      return;
    }
    Alert.alert('카테고리 삭제', `"${cat.name}"을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory(cat.id, cat.is_default);
          } catch (e: any) {
            Alert.alert('삭제 실패', e?.message ?? '카테고리 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      <View className="flex-row items-center px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Text className="text-2xl text-text-primary dark:text-text-dark-primary">←</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-xl font-bold text-text-primary dark:text-text-dark-primary">
          카테고리 관리
        </Text>
        <TouchableOpacity
          className="bg-primary px-4 py-2 rounded-full"
          onPress={() => setShowModal(true)}
        >
          <Text className="text-white text-sm font-semibold">+ 추가</Text>
        </TouchableOpacity>
      </View>

      {/* 타입 탭 */}
      <View className="flex-row mx-5 bg-surface-secondary dark:bg-surface-dark-secondary rounded-2xl p-1 mb-4">
        {CATEGORY_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            className={`flex-1 py-2.5 rounded-xl items-center ${selectedType === type ? 'bg-white dark:bg-surface-dark shadow' : ''}`}
            onPress={() => setSelectedType(type)}
          >
            <Text
              className={`text-sm font-semibold ${
                selectedType === type ? 'text-text-primary dark:text-text-dark-primary' : 'text-text-secondary'
              }`}
            >
              {CATEGORY_TYPE_LABELS[type]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {filtered.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            className="flex-row items-center bg-white dark:bg-surface-dark rounded-2xl px-4 py-3.5 mb-2"
            onLongPress={() => handleDelete(cat)}
            activeOpacity={0.8}
          >
            <View
              className="w-8 h-8 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: cat.color + '30' }}
            >
              <View className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
            </View>
            <Text className="flex-1 text-sm font-medium text-text-primary dark:text-text-dark-primary">
              {cat.name}
            </Text>
            {cat.is_default && (
              <View className="bg-surface-secondary dark:bg-surface-dark-secondary px-2 py-0.5 rounded-full">
                <Text className="text-xs text-text-secondary">기본</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
        {filtered.length === 0 && (
          <View className="items-center py-8">
            <Text className="text-text-secondary">카테고리가 없습니다</Text>
          </View>
        )}
      </ScrollView>

      {/* 카테고리 추가 모달 */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-surface-dark rounded-t-3xl p-6">
            <Text className="text-xl font-bold text-text-primary dark:text-text-dark-primary mb-5">
              카테고리 추가
            </Text>

            <Text className="text-xs font-medium text-text-secondary mb-2">이름</Text>
            <TextInput
              className="border border-border dark:border-border-dark rounded-xl px-4 py-3 text-base text-text-primary dark:text-text-dark-primary mb-4"
              placeholder="카테고리 이름"
              placeholderTextColor="#9CA3AF"
              value={newName}
              onChangeText={setNewName}
            />

            <Text className="text-xs font-medium text-text-secondary mb-2">색상</Text>
            <View className="flex-row flex-wrap gap-3 mb-6">
              {CATEGORY_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  className={`w-8 h-8 rounded-full ${newColor === color ? 'border-2 border-gray-700 dark:border-white' : ''}`}
                  style={{ backgroundColor: color }}
                  onPress={() => setNewColor(color)}
                />
              ))}
            </View>

            <View className="flex-row gap-x-3">
              <TouchableOpacity
                className="flex-1 border border-border py-4 rounded-2xl items-center"
                onPress={() => setShowModal(false)}
              >
                <Text className="text-text-primary font-semibold">취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-4 rounded-2xl items-center ${isSaving ? 'bg-primary/60' : 'bg-primary'}`}
                onPress={handleAdd}
                disabled={isSaving}
              >
                <Text className="text-white font-semibold">{isSaving ? '저장 중...' : '추가'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
