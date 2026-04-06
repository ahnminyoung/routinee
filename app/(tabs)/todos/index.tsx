// 앱 화면/라우팅 로직: app/(tabs)/todos/index.tsx
import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import DraggableFlatList, {
  RenderItemParams, ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { useAuthStore } from '../../../src/stores/auth.store';
import { useTodoStore } from '../../../src/stores/todo.store';
import { Todo } from '../../../src/types';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../../../src/utils/constants';
import { formatDisplayDate, today, toDateString, addMonths, subMonths, getDaysInMonth, isSameDay } from '../../../src/utils/date';
import { formatMonth } from '../../../src/utils/date';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

const STRIP_DAY_COUNT = 14; // 날짜 스트립에 보여줄 날짜 수

export default function TodosScreen() {
  const { user } = useAuthStore();
  const { selectedDate, setSelectedDate, getTodosForDate, fetchTodosForDate,
    toggleComplete, deleteTodo, reorderTodos, moveToDate } = useTodoStore();
  const [refreshing, setRefreshing] = useState(false);

  const todos = getTodosForDate(selectedDate);

  const loadTodos = useCallback(async (force = false) => {
    if (!user) return;
    try {
      await fetchTodosForDate(user.id, selectedDate, force);
    } catch (error) {
      console.warn('[TodosScreen] 할일 조회에 실패했습니다.', error);
    }
  }, [user, selectedDate, fetchTodosForDate]);

  useEffect(() => {
    void loadTodos();
  }, [loadTodos]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTodos(true);
    setRefreshing(false);
  };

  const handleDeleteTodo = (todo: Todo) => {
    Alert.alert('할일 삭제', `"${todo.title}"을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTodo(todo.id);
          } catch (e: any) {
            Alert.alert('삭제 실패', e?.message ?? '할일 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Todo>) => (
    <ScaleDecorator>
      <TodoItem
        todo={item}
        isActive={isActive}
        onLongPress={drag}
        onToggle={() => toggleComplete(item.id)}
        onPress={() => router.push(`/(tabs)/todos/${item.id}`)}
        onDelete={() => handleDeleteTodo(item)}
      />
    </ScaleDecorator>
  );

  // 날짜 스트립 생성 (오늘 기준 ±7일)
  const stripDates = Array.from({ length: STRIP_DAY_COUNT }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 3 + i);
    return toDateString(d);
  });

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      {/* 헤더 */}
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-text-primary dark:text-text-dark-primary">
          할일
        </Text>
        <TouchableOpacity
          className="bg-primary w-9 h-9 rounded-full items-center justify-center"
          onPress={() => router.push('/modals/add-todo')}
        >
          <Text className="text-white text-xl leading-6">+</Text>
        </TouchableOpacity>
      </View>

      {/* 날짜 스트립 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-20"
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {stripDates.map((date) => {
          const isSelected = date === selectedDate;
          const isToday    = date === today();
          const d = parseISO(date);
          return (
            <TouchableOpacity
              key={date}
              className={`items-center justify-center w-14 h-14 rounded-2xl ${
                isSelected ? 'bg-primary' : 'bg-white dark:bg-surface-dark'
              }`}
              onPress={() => setSelectedDate(date)}
            >
              <Text
                style={{ fontSize: 10 }}
                className={isSelected ? 'text-white' : 'text-text-secondary'}
              >
                {format(d, 'eee', { locale: ko })}
              </Text>
              <Text
                className={`text-base font-bold ${isSelected ? 'text-white' : 'text-text-primary dark:text-text-dark-primary'}`}
              >
                {format(d, 'd')}
              </Text>
              {isToday && (
                <View className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-primary'}`} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 선택된 날짜 표시 */}
      <View className="px-5 py-3">
        <Text className="text-base font-semibold text-text-primary dark:text-text-dark-primary">
          {formatDisplayDate(selectedDate)}
        </Text>
        <Text className="text-sm text-text-secondary dark:text-text-dark-secondary">
          {todos.length}개의 할일
        </Text>
      </View>

      {/* 할일 목록 (드래그 가능) */}
      {todos.length === 0 ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <View className="flex-1 items-center justify-center">
            <Text className="text-5xl mb-4">📝</Text>
            <Text className="text-text-secondary dark:text-text-dark-secondary text-base">
              할일이 없습니다
            </Text>
            <TouchableOpacity
              className="mt-4 bg-primary px-6 py-2.5 rounded-full"
              onPress={() => router.push('/modals/add-todo')}
            >
              <Text className="text-white font-semibold">할일 추가</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <DraggableFlatList
          data={todos}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onDragEnd={({ data }) => reorderTodos(data, selectedDate)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        />
      )}
    </SafeAreaView>
  );
}

function TodoItem({
  todo, isActive, onLongPress, onToggle, onPress, onDelete,
}: {
  todo: Todo;
  isActive: boolean;
  onLongPress: () => void;
  onToggle: () => void;
  onPress: () => void;
  onDelete: () => void;
}) {
  const isCompleted = todo.status === 'completed';
  return (
    <View
      className={`flex-row items-center bg-white dark:bg-surface-dark rounded-2xl px-4 py-3.5 mb-2 ${
        isActive ? 'shadow-lg opacity-90' : ''
      }`}
    >
      {/* 완료 버튼 */}
      <TouchableOpacity
        className={`w-6 h-6 rounded-full border-2 mr-3 items-center justify-center ${
          isCompleted ? 'bg-primary border-primary' : 'border-border dark:border-border-dark'
        }`}
        onPress={onToggle}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {isCompleted && <Text className="text-white text-xs font-bold">✓</Text>}
      </TouchableOpacity>

      {/* 내용 */}
      <TouchableOpacity className="flex-1" onPress={onPress} onLongPress={onLongPress}>
        <Text
          className={`text-sm font-medium ${
            isCompleted
              ? 'text-text-secondary line-through'
              : 'text-text-primary dark:text-text-dark-primary'
          }`}
          numberOfLines={1}
        >
          {todo.title}
        </Text>
        {todo.description ? (
          <Text className="text-xs text-text-secondary mt-0.5" numberOfLines={1}>
            {todo.description}
          </Text>
        ) : null}
      </TouchableOpacity>

      {/* 우선순위 배지 */}
      <View
        className="px-2 py-0.5 rounded-full mr-2"
        style={{ backgroundColor: PRIORITY_COLORS[todo.priority ?? 'medium'] + '20' }}
      >
        <Text
          style={{ fontSize: 10, color: PRIORITY_COLORS[todo.priority ?? 'medium'] }}
          className="font-medium"
        >
          {PRIORITY_LABELS[todo.priority ?? 'medium']}
        </Text>
      </View>

      {/* 삭제 버튼 */}
      <TouchableOpacity
        onPress={onDelete}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text className="text-text-secondary text-base">×</Text>
      </TouchableOpacity>
    </View>
  );
}
