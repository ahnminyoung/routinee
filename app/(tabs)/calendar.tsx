import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl, Alert,
  Animated, PanResponder,
} from 'react-native';
import { router } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/auth.store';
import { useTodoStore } from '../../src/stores/todo.store';
import { useFinanceStore } from '../../src/stores/finance.store';
import { formatCurrency } from '../../src/utils/currency';
import {
  getCalendarGrid, isSameMonth, today, toDateString,
  formatDisplayDate, formatMonth, addMonths, subMonths,
} from '../../src/utils/date';
import { DAY_NAMES, PRIORITY_COLORS } from '../../src/utils/constants';
import { format } from 'date-fns';
import { Todo, Transaction } from '../../src/types';
import { useFinanceShareCount } from '../../src/hooks/useFinanceShareCount';

type DayRect = { x: number; y: number; width: number; height: number };
type CalendarViewMode = 'todo' | 'finance';

const toAlphaColor = (hex: string, alphaHex: string) => {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  if (normalized.length !== 6) return hex;
  return `#${normalized}${alphaHex}`;
};

export default function CalendarScreen() {
  const { user } = useAuthStore();
  const {
    fetchTodosForRange,
    getTodosForDate,
    moveToDate,
    toggleComplete,
    setSelectedDate: setTodoSelectedDate,
  } = useTodoStore();
  const { fetchMonth, getTransactionsForDate } = useFinanceStore();
  const { sharedCount, isShared } = useFinanceShareCount(user?.id);
  const { height: windowHeight } = useWindowDimensions();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('todo');
  const [refreshing, setRefreshing] = useState(false);
  const [isDraggingTodo, setIsDraggingTodo] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const dayRefs = useRef<Record<string, any>>({});
  const dayRects = useRef<Record<string, DayRect>>({});

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;
  const calendarDays = useMemo(() => getCalendarGrid(year, month), [year, month]);
  const visibleStartDate = toDateString(calendarDays[0]);
  const visibleEndDate = toDateString(calendarDays[calendarDays.length - 1]);

  const updateDayRect = useCallback((date: string) => {
    const ref = dayRefs.current[date];
    if (!ref || typeof ref.measureInWindow !== 'function') return;
    requestAnimationFrame(() => {
      ref.measureInWindow((x: number, y: number, width: number, height: number) => {
        dayRects.current[date] = { x, y, width, height };
      });
    });
  }, []);

  const refreshDayRects = useCallback(() => {
    Object.keys(dayRefs.current).forEach((date) => updateDayRect(date));
  }, [updateDayRect]);

  const findDropDate = useCallback((pageX: number, pageY: number): string | null => {
    for (const [date, rect] of Object.entries(dayRects.current)) {
      if (
        pageX >= rect.x &&
        pageX <= rect.x + rect.width &&
        pageY >= rect.y &&
        pageY <= rect.y + rect.height
      ) {
        return date;
      }
    }
    return null;
  }, []);

  const handleDropTodo = useCallback(async (
    todoId: string,
    fromDate: string,
    pageX: number,
    pageY: number
  ) => {
    const dropDate = findDropDate(pageX, pageY);
    if (!dropDate || dropDate === fromDate) return;

    try {
      await moveToDate(todoId, fromDate, dropDate);
      setSelectedDate(dropDate);
    } catch (e: any) {
      Alert.alert('이동 실패', e?.message ?? '할일 날짜 이동에 실패했습니다.');
    }
  }, [findDropDate, moveToDate]);

  const handleToggleTodo = useCallback(async (todoId: string) => {
    try {
      await toggleComplete(todoId);
    } catch (e: any) {
      Alert.alert('변경 실패', e?.message ?? '할일 상태 변경에 실패했습니다.');
    }
  }, [toggleComplete]);

  const handlePressMoreRecords = useCallback((date: string) => {
    setSelectedDate(date);
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }, []);

  const handlePressAddForSelectedDate = useCallback(() => {
    if (viewMode === 'todo') {
      if (selectedDate) {
        setTodoSelectedDate(selectedDate);
      }
      router.push('/modals/add-todo');
      return;
    }
    router.push('/modals/add-transaction');
  }, [viewMode, selectedDate, setTodoSelectedDate]);

  const loadData = useCallback(async (force = false) => {
    if (!user) return;
    try {
      await Promise.all([
        fetchTodosForRange(user.id, visibleStartDate, visibleEndDate, force),
        fetchMonth(user.id, year, month, force),
      ]);
    } catch (error) {
      console.warn('[CalendarScreen] 데이터 조회에 실패했습니다.', error);
    } finally {
      requestAnimationFrame(() => refreshDayRects());
    }
  }, [
    user,
    visibleStartDate,
    visibleEndDate,
    year,
    month,
    fetchTodosForRange,
    fetchMonth,
    refreshDayRects,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!user) return;
    void loadData(true);
  }, [user, sharedCount, loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  };

  const todayStr = today();
  const selectedTodos = selectedDate ? getTodosForDate(selectedDate) : [];
  const selectedTransactions = selectedDate ? getTransactionsForDate(selectedDate) : [];
  const dayIncome = selectedTransactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const dayExpense = selectedTransactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const dayCellHeight = Math.max(96, Math.floor((windowHeight - 210) / 6));

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isDraggingTodo}
        refreshControl={
          isDraggingTodo
            ? undefined
            : <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-text-primary dark:text-text-dark-primary">
            캘린더
          </Text>
        </View>

        <View className="flex-row items-center justify-between px-5 py-2">
          <TouchableOpacity onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <Text className="text-2xl text-text-primary dark:text-text-dark-primary">‹</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-text-primary dark:text-text-dark-primary">
            {formatMonth(currentMonth)}
          </Text>
          <TouchableOpacity onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <Text className="text-2xl text-text-primary dark:text-text-dark-primary">›</Text>
          </TouchableOpacity>
        </View>

        <View className="px-5 mb-2">
          <View className="flex-row bg-white dark:bg-surface-dark rounded-xl p-1">
            <TouchableOpacity
              className={`flex-1 py-2 rounded-lg items-center ${viewMode === 'todo' ? 'bg-primary' : ''}`}
              onPress={() => setViewMode('todo')}
            >
              <Text className={`text-sm font-semibold ${viewMode === 'todo' ? 'text-white' : 'text-text-secondary'}`}>
                할일
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 py-2 rounded-lg items-center ${viewMode === 'finance' ? 'bg-primary' : ''}`}
              onPress={() => setViewMode('finance')}
            >
              <Text className={`text-sm font-semibold ${viewMode === 'finance' ? 'text-white' : 'text-text-secondary'}`}>
                가계부
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {viewMode === 'finance' && isShared && (
          <View className="px-5 mb-2">
            <View className="self-start px-3 py-1 rounded-full bg-primary/15">
              <Text className="text-xs font-semibold text-primary">
                가계부 공유 중 · {sharedCount}명
              </Text>
            </View>
          </View>
        )}

        <View className="flex-row px-5 mb-1">
          {DAY_NAMES.map((day) => (
            <View key={day} className="flex-1 items-center">
              <Text style={{ fontSize: 11 }} className="text-text-secondary font-medium">
                {day}
              </Text>
            </View>
          ))}
        </View>

        <View className="px-5 mb-4" onLayout={refreshDayRects}>
          {Array.from({ length: Math.ceil(calendarDays.length / 7) }, (_, weekIdx) => (
            <View key={weekIdx} className="flex-row">
              {calendarDays.slice(weekIdx * 7, weekIdx * 7 + 7).map((day) => {
                const dateStr = toDateString(day);
                const inCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const dayTodos = getTodosForDate(dateStr);
                const dayTransactions = getTransactionsForDate(dateStr);
                const visibleTodos = dayTodos.slice(0, 3);
                const visibleTransactions = dayTransactions.slice(0, 3);
                const todoExtraCount = Math.max(0, dayTodos.length - visibleTodos.length);
                const txExtraCount = Math.max(0, dayTransactions.length - visibleTransactions.length);

                return (
                  <View
                    key={dateStr}
                    className="flex-1 border border-border/40 dark:border-border-dark/40"
                  >
                    <TouchableOpacity
                      ref={(node) => { dayRefs.current[dateStr] = node; }}
                      onLayout={() => updateDayRect(dateStr)}
                      className={`px-1 py-1.5 ${
                        isSelected ? 'bg-primary/15' : ''
                      }`}
                      style={{ minHeight: dayCellHeight }}
                      onPress={() => setSelectedDate(dateStr)}
                      activeOpacity={0.9}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          !inCurrentMonth
                            ? 'text-text-secondary/40 dark:text-text-dark-secondary/40'
                            : isToday
                              ? 'text-primary'
                              : 'text-text-primary dark:text-text-dark-primary'
                        }`}
                      >
                        {format(day, 'd')}
                      </Text>
                      <View className="mt-1 gap-y-1">
                        {viewMode === 'todo' ? (
                          <>
                            {visibleTodos.map((todo) => {
                              const chipColor = todo.label_color || PRIORITY_COLORS[todo.priority ?? 'medium'];
                              return (
                                <DraggableTodoChip
                                  key={todo.id}
                                  todo={todo}
                                  fromDate={dateStr}
                                  color={chipColor}
                                  isDimmed={!inCurrentMonth}
                                  onDrop={handleDropTodo}
                                  onDragStateChange={(dragging) => {
                                    if (dragging) refreshDayRects();
                                    setIsDraggingTodo(dragging);
                                  }}
                                />
                              );
                            })}
                            {todoExtraCount > 0 && (
                              <TouchableOpacity
                                onPress={() => handlePressMoreRecords(dateStr)}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              >
                                <Text className="text-[10px] text-primary px-1 font-semibold">
                                  +{todoExtraCount}개 더
                                </Text>
                              </TouchableOpacity>
                            )}
                          </>
                        ) : (
                          <>
                            {visibleTransactions.map((tx) => (
                              <FinanceEventChip
                                key={tx.id}
                                transaction={tx}
                                isDimmed={!inCurrentMonth}
                              />
                            ))}
                            {txExtraCount > 0 && (
                              <TouchableOpacity
                                onPress={() => handlePressMoreRecords(dateStr)}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              >
                                <Text className="text-[10px] text-primary px-1 font-semibold">
                                  +{txExtraCount}개 더
                                </Text>
                              </TouchableOpacity>
                            )}
                          </>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {selectedDate ? (
          <View className="px-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-text-primary dark:text-text-dark-primary">
                {formatDisplayDate(selectedDate)}
              </Text>
              <TouchableOpacity
                className="w-8 h-8 rounded-full bg-primary items-center justify-center"
                onPress={handlePressAddForSelectedDate}
              >
                <Text className="text-white text-xl leading-6">+</Text>
              </TouchableOpacity>
            </View>

            {viewMode === 'finance' && (dayIncome > 0 || dayExpense > 0) && (
              <View className="flex-row gap-x-3 mb-3">
                {dayIncome > 0 && (
                  <View className="flex-1 bg-income/10 rounded-2xl p-3">
                    <Text className="text-xs text-income mb-1">수입</Text>
                    <Text className="text-sm font-bold text-income">+{formatCurrency(dayIncome)}</Text>
                  </View>
                )}
                {dayExpense > 0 && (
                  <View className="flex-1 bg-expense/10 rounded-2xl p-3">
                    <Text className="text-xs text-expense mb-1">지출</Text>
                    <Text className="text-sm font-bold text-expense">-{formatCurrency(dayExpense)}</Text>
                  </View>
                )}
              </View>
            )}

            {viewMode === 'todo' && selectedTodos.length > 0 && (
              <View className="mb-3">
                <Text className="text-sm font-semibold text-text-secondary mb-2">할일</Text>
                <Text className="text-xs text-text-secondary mb-2">
                  왼쪽 체크는 완료 처리, 오른쪽 ⋮⋮는 날짜 이동 드래그입니다.
                </Text>
                <View className="bg-white dark:bg-surface-dark rounded-2xl overflow-hidden">
                  {selectedTodos.map((todo, i) => (
                    <DraggableTodoRow
                      key={todo.id}
                      todo={todo}
                      fromDate={selectedDate}
                      isLast={i === selectedTodos.length - 1}
                      onToggle={() => void handleToggleTodo(todo.id)}
                      onDrop={handleDropTodo}
                      onDragStateChange={(dragging) => {
                        if (dragging) refreshDayRects();
                        setIsDraggingTodo(dragging);
                      }}
                    />
                  ))}
                </View>
              </View>
            )}

            {viewMode === 'finance' && selectedTransactions.length > 0 && (
              <View className="mb-3">
                <Text className="text-sm font-semibold text-text-secondary mb-2">거래</Text>
                <View className="bg-white dark:bg-surface-dark rounded-2xl overflow-hidden">
                  {selectedTransactions.map((tx, i) => {
                    const isIncome = tx.type === 'income';
                    const isExpense = tx.type === 'expense';
                    return (
                      <View
                        key={tx.id}
                        className={`flex-row items-center px-4 py-3 ${
                          i < selectedTransactions.length - 1 ? 'border-b border-border dark:border-border-dark' : ''
                        }`}
                      >
                        <Text className="flex-1 text-sm text-text-primary dark:text-text-dark-primary" numberOfLines={1}>
                          {tx.description}
                        </Text>
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: isIncome ? '#10B981' : isExpense ? '#EF4444' : '#F59E0B' }}
                        >
                          {isIncome ? '+' : isExpense ? '-' : ''}
                          {formatCurrency(tx.amount)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {viewMode === 'todo' && selectedTodos.length === 0 && (
              <View className="items-center py-6">
                <Text className="text-3xl mb-2">📭</Text>
                <Text className="text-text-secondary text-sm">이 날의 할일이 없습니다</Text>
              </View>
            )}

            {viewMode === 'finance' && selectedTransactions.length === 0 && (
              <View className="items-center py-6">
                <Text className="text-3xl mb-2">📭</Text>
                <Text className="text-text-secondary text-sm">이 날의 거래 내역이 없습니다</Text>
              </View>
            )}
          </View>
        ) : (
          <View className="px-5 pb-2">
            <Text className="text-center text-text-secondary text-sm">
              날짜를 선택하면 해당 날짜의 {viewMode === 'todo' ? '할일' : '거래'}이(가) 표시됩니다.
            </Text>
          </View>
        )}

        <View className={selectedDate ? 'h-8' : 'h-2'} />
      </ScrollView>
    </SafeAreaView>
  );
}

function FinanceEventChip({
  transaction,
  isDimmed,
}: {
  transaction: Transaction;
  isDimmed: boolean;
}) {
  const color = transaction.type === 'income'
    ? '#10B981'
    : transaction.type === 'expense'
      ? '#EF4444'
      : '#F59E0B';
  const sign = transaction.type === 'income'
    ? '+'
    : transaction.type === 'expense'
      ? '-'
      : '';

  return (
    <View
      className="px-1 py-[1px] rounded-md min-h-[20px] justify-center"
      style={{ backgroundColor: isDimmed ? toAlphaColor(color, '88') : color }}
    >
      <Text className="text-[9px] leading-[10px] text-white font-semibold" numberOfLines={1}>
        {sign}{formatCurrency(transaction.amount)}
      </Text>
      <Text className="text-[8px] leading-[9px] text-white/90" numberOfLines={1}>
        {transaction.description}
      </Text>
    </View>
  );
}

function DraggableTodoChip({
  todo,
  fromDate,
  color,
  isDimmed,
  onDrop,
  onDragStateChange,
}: {
  todo: Todo;
  fromDate: string;
  color: string;
  isDimmed: boolean;
  onDrop: (todoId: string, fromDate: string, pageX: number, pageY: number) => Promise<void> | void;
  onDragStateChange: (dragging: boolean) => void;
}) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const isCompleted = todo.status === 'completed';

  const animateBack = useCallback(() => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start();
  }, [pan]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        onDragStateChange(true);
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_evt, gestureState) => {
        onDragStateChange(false);
        animateBack();
        void onDrop(todo.id, fromDate, gestureState.moveX, gestureState.moveY);
      },
      onPanResponderTerminate: () => {
        onDragStateChange(false);
        animateBack();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        transform: pan.getTranslateTransform(),
        zIndex: 20,
        elevation: 8,
      }}
    >
      <View
        className="px-1 py-[1px] rounded-md min-h-[20px] justify-center"
        style={{
          backgroundColor: isCompleted
            ? toAlphaColor(color, isDimmed ? '66' : '88')
            : (isDimmed ? toAlphaColor(color, '99') : color),
        }}
      >
        <Text
          className={`text-[9px] leading-[10px] text-white font-semibold ${
            isCompleted ? 'line-through opacity-90' : ''
          }`}
          numberOfLines={2}
        >
          {isCompleted ? `✓ ${todo.title}` : todo.title}
        </Text>
      </View>
    </Animated.View>
  );
}

function DraggableTodoRow({
  todo,
  fromDate,
  isLast,
  onToggle,
  onDrop,
  onDragStateChange,
}: {
  todo: Todo;
  fromDate: string;
  isLast: boolean;
  onToggle: () => void;
  onDrop: (todoId: string, fromDate: string, pageX: number, pageY: number) => Promise<void> | void;
  onDragStateChange: (dragging: boolean) => void;
}) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [isDragging, setIsDragging] = useState(false);

  const animateBack = useCallback(() => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start();
  }, [pan]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        onDragStateChange(true);
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_evt, gestureState) => {
        setIsDragging(false);
        onDragStateChange(false);
        animateBack();
        void onDrop(todo.id, fromDate, gestureState.moveX, gestureState.moveY);
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        onDragStateChange(false);
        animateBack();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  return (
    <Animated.View
      className={`flex-row items-center px-4 py-3 ${
        !isLast ? 'border-b border-border dark:border-border-dark' : ''
      }`}
      style={{
        transform: pan.getTranslateTransform(),
        zIndex: isDragging ? 40 : 1,
        elevation: isDragging ? 12 : 0,
      }}
    >
      <TouchableOpacity
        onPress={onToggle}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
          todo.status === 'completed' ? 'bg-primary border-primary' : 'border-border'
        }`}
      >
        {todo.status === 'completed' && <Text className="text-white text-xs">✓</Text>}
      </TouchableOpacity>
      <Text
        className={`flex-1 text-sm ${
          todo.status === 'completed'
            ? 'text-text-secondary line-through'
            : 'text-text-primary dark:text-text-dark-primary'
        }`}
        numberOfLines={1}
      >
        {todo.title}
      </Text>
      <View
        {...panResponder.panHandlers}
        className="ml-3 px-3 py-2 rounded-lg bg-surface-secondary dark:bg-surface-dark-secondary"
      >
        <Text className="text-xs text-text-secondary">⋮⋮</Text>
      </View>
    </Animated.View>
  );
}
