import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Switch, RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTodoStore } from '../../../src/stores/todo.store';
import { useCategoryStore } from '../../../src/stores/category.store';
import { useAuthStore } from '../../../src/stores/auth.store';
import { Todo, TodoPriority, UpdateTodoDto } from '../../../src/types';
import { PRIORITY_LABELS, PRIORITY_COLORS } from '../../../src/utils/constants';
import { formatDisplayDate, today } from '../../../src/utils/date';

const PRIORITIES: TodoPriority[] = ['low', 'medium', 'high', 'urgent'];

export default function TodoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { todosByDate, updateTodo, deleteTodo, fetchTodosForDate } = useTodoStore();
  const { getCategoriesByType, fetchCategories } = useCategoryStore();

  // 모든 날짜에서 해당 ID의 할일 찾기
  const todo = Object.values(todosByDate).flat().find(t => t.id === id);

  const [title, setTitle]           = useState(todo?.title ?? '');
  const [description, setDesc]      = useState(todo?.description ?? '');
  const [priority, setPriority]     = useState<TodoPriority>(todo?.priority ?? 'medium');
  const [categoryId, setCategoryId] = useState(todo?.category_id ?? null);
  const [dueDate, setDueDate]       = useState(todo?.due_date ?? today());
  const [isRecurring, setRecurring] = useState(todo?.is_recurring ?? false);
  const [isSaving, setSaving]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const todoCategories = getCategoriesByType('todo');

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await Promise.all([
        fetchTodosForDate(user.id, dueDate, true),
        fetchCategories(user.id),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  if (!todo) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark items-center justify-center">
        <Text className="text-text-secondary">할일을 찾을 수 없습니다.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-primary">돌아가기</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('입력 오류', '제목을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const updates: UpdateTodoDto = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        category_id: categoryId,
        due_date: dueDate,
        is_recurring: isRecurring,
      };
      await updateTodo(id!, updates);
      router.back();
    } catch (e: any) {
      Alert.alert('저장 실패', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('할일 삭제', '이 할일을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTodo(id!);
            router.back();
          } catch (e: any) {
            Alert.alert('삭제 실패', e?.message ?? '할일 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      {/* 헤더 */}
      <View className="flex-row items-center px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Text className="text-2xl text-text-primary dark:text-text-dark-primary">←</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-xl font-bold text-text-primary dark:text-text-dark-primary">
          할일 편집
        </Text>
        <TouchableOpacity onPress={handleDelete}>
          <Text className="text-expense text-sm font-medium">삭제</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* 제목 */}
        <View className="bg-white dark:bg-surface-dark rounded-2xl p-4 mb-4">
          <Text className="text-xs font-medium text-text-secondary mb-2">제목</Text>
          <TextInput
            className="text-base text-text-primary dark:text-text-dark-primary"
            placeholder="할일 제목"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
            multiline
          />
        </View>

        {/* 메모 */}
        <View className="bg-white dark:bg-surface-dark rounded-2xl p-4 mb-4">
          <Text className="text-xs font-medium text-text-secondary mb-2">메모</Text>
          <TextInput
            className="text-sm text-text-primary dark:text-text-dark-primary"
            placeholder="추가 내용을 입력하세요"
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDesc}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* 우선순위 */}
        <View className="bg-white dark:bg-surface-dark rounded-2xl p-4 mb-4">
          <Text className="text-xs font-medium text-text-secondary mb-3">우선순위</Text>
          <View className="flex-row gap-x-2">
            {PRIORITIES.map((p) => (
              <TouchableOpacity
                key={p}
                className={`flex-1 py-2 rounded-xl items-center border ${
                  priority === p ? 'border-transparent' : 'border-border dark:border-border-dark'
                }`}
                style={priority === p ? { backgroundColor: PRIORITY_COLORS[p] } : {}}
                onPress={() => setPriority(p)}
              >
                <Text
                  style={{ fontSize: 11 }}
                  className={priority === p ? 'text-white font-semibold' : 'text-text-secondary'}
                >
                  {PRIORITY_LABELS[p]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 카테고리 */}
        {todoCategories.length > 0 && (
          <View className="bg-white dark:bg-surface-dark rounded-2xl p-4 mb-4">
            <Text className="text-xs font-medium text-text-secondary mb-3">카테고리</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-x-2">
                <TouchableOpacity
                  className={`px-3 py-1.5 rounded-full border ${
                    categoryId === null ? 'bg-primary border-primary' : 'border-border dark:border-border-dark'
                  }`}
                  onPress={() => setCategoryId(null)}
                >
                  <Text className={`text-xs ${categoryId === null ? 'text-white' : 'text-text-secondary'}`}>
                    없음
                  </Text>
                </TouchableOpacity>
                {todoCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    className={`px-3 py-1.5 rounded-full border ${
                      categoryId === cat.id ? 'border-transparent' : 'border-border dark:border-border-dark'
                    }`}
                    style={categoryId === cat.id ? { backgroundColor: cat.color } : {}}
                    onPress={() => setCategoryId(cat.id)}
                  >
                    <Text
                      style={{ fontSize: 12 }}
                      className={categoryId === cat.id ? 'text-white font-medium' : 'text-text-secondary'}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* 반복 여부 */}
        <View className="bg-white dark:bg-surface-dark rounded-2xl px-4 py-3.5 mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
              반복 할일
            </Text>
            <Text className="text-xs text-text-secondary mt-0.5">
              정기적으로 반복되는 할일
            </Text>
          </View>
          <Switch
            value={isRecurring}
            onValueChange={setRecurring}
            trackColor={{ true: '#6366F1' }}
          />
        </View>

        {/* 저장 버튼 */}
        <TouchableOpacity
          className={`py-4 rounded-2xl items-center ${isSaving ? 'bg-primary/60' : 'bg-primary'}`}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text className="text-white text-base font-semibold">
            {isSaving ? '저장 중...' : '저장'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
