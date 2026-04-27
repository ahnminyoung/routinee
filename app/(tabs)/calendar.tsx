// 앱 화면/라우팅 로직: app/(tabs)/calendar.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Alert,
  Animated, PanResponder, Modal, StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useAssetStore } from '../../src/stores/asset.store';

type DayRect = { x: number; y: number; width: number; height: number };
type CalendarViewMode = 'todo' | 'finance';

const toAlphaColor = (hex: string, alphaHex: string) => {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  if (normalized.length !== 6) return hex;
  return `#${normalized}${alphaHex}`;
};

export default function CalendarScreen() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const {
    fetchTodosForRange,
    getTodosForDate,
    moveToDate,
    toggleComplete,
    setSelectedDate: setTodoSelectedDate,
  } = useTodoStore();
  const { fetchMonth, getTransactionsForDate, getSummaryForMonth } = useFinanceStore();
  const { totalBalance, fetchAssets } = useAssetStore();
  const { sharedCount, isShared } = useFinanceShareCount(user?.id);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('todo');
  const [fabOpen, setFabOpen] = useState(false);

  const toggleFab = useCallback(() => {
    setFabOpen((prev) => !prev);
  }, []);

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
    openSheet(date);
  }, [openSheet]);

  const handleDayPress = useCallback((dateStr: string) => {
    if (dateStr === selectedDate) {
      openSheet(dateStr);
    } else {
      setSelectedDate(dateStr);
    }
  }, [selectedDate, openSheet]);

  const handleAddTodo = useCallback(() => {
    toggleFab();
    if (selectedDate) setTodoSelectedDate(selectedDate);
    router.push('/modals/add-todo');
  }, [selectedDate, setTodoSelectedDate, toggleFab]);

  const handleAddTransaction = useCallback(() => {
    if (selectedDate) setTodoSelectedDate(selectedDate);
    toggleFab();
    router.push('/modals/add-transaction');
  }, [selectedDate, setTodoSelectedDate, toggleFab]);

  const loadData = useCallback(async (force = false) => {
    if (!user) return;
    try {
      await Promise.all([
        fetchTodosForRange(user.id, visibleStartDate, visibleEndDate, force),
        fetchMonth(user.id, year, month, force),
        fetchAssets(user.id),
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
    fetchAssets,
    refreshDayRects,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!user) return;
    void loadData(true);
  }, [user, sharedCount, loadData]);

  const todayStr = today();
  const selectedTodos = selectedDate ? getTodosForDate(selectedDate) : [];
  const selectedTransactions = selectedDate ? getTransactionsForDate(selectedDate) : [];
  const dayIncome = selectedTransactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const dayExpense = selectedTransactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const tabBarHeight = 80;
  const fabBottomOffset = tabBarHeight + insets.bottom + 18;

  const SHEET_HEIGHT = 420;
  const KO_DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const openSheet = useCallback((dateStr: string) => {
    setSheetDate(dateStr);
    setSheetVisible(true);
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 25,
      stiffness: 200,
    }).start();
  }, [sheetAnim]);

  const closeSheet = useCallback(() => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    // 애니메이션 콜백 대신 setTimeout으로 보장 — 콜백이 인터럽트되어도 Modal 반드시 닫힘
    setTimeout(() => {
      setSheetVisible(false);
      setSheetDate(null);
    }, 220);
  }, [sheetAnim]);

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_HEIGHT, 0],
  });

  const handleSheetAdd = useCallback(() => {
    if (sheetDate) setTodoSelectedDate(sheetDate);
    router.push(viewMode === 'todo' ? '/modals/add-todo' : '/modals/add-transaction');
  }, [sheetDate, viewMode, setTodoSelectedDate]);

  const sheetTodos = sheetDate ? getTodosForDate(sheetDate) : [];
  const sheetTransactions = sheetDate ? getTransactionsForDate(sheetDate) : [];
  const sheetIncome = sheetTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const sheetExpense = sheetTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const monthlySummary = getSummaryForMonth(year, month);
  const todayTodos = getTodosForDate(todayStr);
  const todayCompleted = todayTodos.filter((t) => t.status === 'completed').length;
  const todayTotal = todayTodos.length;
  const completionRate = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      <View className="flex-1">
        {/* 월 헤더: 월 탐색 + 재정 요약 */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
          <TouchableOpacity onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <Text className="text-2xl text-text-primary dark:text-text-dark-primary px-1">‹</Text>
          </TouchableOpacity>
          <View className="flex-1 items-center">
            <Text className="text-lg font-bold text-text-primary dark:text-text-dark-primary">
              {formatMonth(currentMonth)} ▾
            </Text>
            <View className="flex-row gap-x-3 mt-0.5">
              <Text style={{ fontSize: 11 }} className="text-income font-semibold">
                +{formatCurrency(monthlySummary.total_income)}
              </Text>
              <Text style={{ fontSize: 11 }} className="text-expense font-semibold">
                -{formatCurrency(monthlySummary.total_expense)}
              </Text>
              <Text style={{ fontSize: 11 }} className="text-text-secondary">
                자산 {formatCurrency(totalBalance)}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <Text className="text-2xl text-text-primary dark:text-text-dark-primary px-1">›</Text>
          </TouchableOpacity>
        </View>

        {/* 오늘 할일 완료 게이지 */}
        <View className="mx-5 mb-2 bg-white dark:bg-surface-dark rounded-2xl px-4 py-2">
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
              오늘 할일
            </Text>
            <Text className="text-xs text-text-secondary dark:text-text-dark-secondary">
              {todayTotal > 0 ? `${todayCompleted}/${todayTotal} 완료 · ${completionRate}%` : '할일 없음'}
            </Text>
          </View>
          <View className="h-2 bg-border dark:bg-border-dark rounded-full overflow-hidden">
            <View
              className="h-2 rounded-full"
              style={{
                width: `${completionRate}%`,
                backgroundColor: completionRate === 100 ? '#10B981' : '#6366F1',
              }}
            />
          </View>
          {completionRate === 100 && todayTotal > 0 && (
            <Text className="text-xs text-income font-semibold mt-1 text-center">
              🎉 오늘 할일 모두 완료!
            </Text>
          )}
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

        {/* 캘린더 그리드: flex-1로 남은 공간을 모두 채움 */}
        <View className="flex-1 px-5" onLayout={refreshDayRects}>
          {Array.from({ length: Math.ceil(calendarDays.length / 7) }, (_, weekIdx) => (
            <View key={weekIdx} className="flex-1 flex-row">
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
                      className={`flex-1 px-1 py-1.5 ${
                        isSelected ? 'bg-primary/15' : ''
                      }`}
                      onPress={() => handleDayPress(dateStr)}
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

      </View>

      {/* 날짜 상세 바텀시트: Modal로 레이아웃 완전 분리 */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
        statusBarTranslucent
      >
        {/* 백드롭 */}
        <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: sheetAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeSheet} />
        </Animated.View>

        {/* 시트 */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: SHEET_HEIGHT,
            backgroundColor: '#111111',
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            transform: [{ translateY: sheetTranslateY }],
            overflow: 'hidden',
          }}
        >
          {/* 드래그 핸들 */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(160,160,160,0.4)' }} />
          </View>

          {/* 헤더: 날짜 + 추가 버튼 */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 6, paddingBottom: 14 }}>
            <View>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#ffffff', lineHeight: 28 }}>
                {sheetDate ? `${format(new Date(sheetDate), 'M월 d일')} ${KO_DAYS[new Date(sheetDate).getDay()]}` : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleSheetAdd}
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#ffffff', fontSize: 22, lineHeight: 26, fontWeight: '300' }}>+</Text>
            </TouchableOpacity>
          </View>

          {/* 내용 */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 + insets.bottom }}
            showsVerticalScrollIndicator={false}
          >
            {viewMode === 'finance' && (sheetIncome > 0 || sheetExpense > 0) && (
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                {sheetIncome > 0 && (
                  <View style={{ flex: 1, backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 16, padding: 12 }}>
                    <Text style={{ fontSize: 11, color: '#10B981', marginBottom: 4 }}>수입</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#10B981' }}>+{formatCurrency(sheetIncome)}</Text>
                  </View>
                )}
                {sheetExpense > 0 && (
                  <View style={{ flex: 1, backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 16, padding: 12 }}>
                    <Text style={{ fontSize: 11, color: '#EF4444', marginBottom: 4 }}>지출</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#EF4444' }}>-{formatCurrency(sheetExpense)}</Text>
                  </View>
                )}
              </View>
            )}

            {viewMode === 'todo' && sheetTodos.length > 0 && (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
                {sheetTodos.map((todo, i) => (
                  <DraggableTodoRow
                    key={todo.id}
                    todo={todo}
                    fromDate={sheetDate!}
                    color={todo.label_color || PRIORITY_COLORS[todo.priority ?? 'medium']}
                    isLast={i === sheetTodos.length - 1}
                    onToggle={() => void handleToggleTodo(todo.id)}
                    onDrop={handleDropTodo}
                    onDragStateChange={(dragging) => { if (dragging) refreshDayRects(); }}
                  />
                ))}
              </View>
            )}

            {viewMode === 'finance' && sheetTransactions.length > 0 && (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
                {sheetTransactions.map((tx, i) => {
                  const isIncome = tx.type === 'income';
                  const isExpense = tx.type === 'expense';
                  return (
                    <View
                      key={tx.id}
                      style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: 16, paddingVertical: 13,
                        borderBottomWidth: i < sheetTransactions.length - 1 ? 1 : 0,
                        borderBottomColor: 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <Text style={{ flex: 1, fontSize: 14, color: '#ffffff' }} numberOfLines={1}>
                        {tx.description}
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: isIncome ? '#10B981' : isExpense ? '#EF4444' : '#F59E0B' }}>
                        {isIncome ? '+' : isExpense ? '-' : ''}{formatCurrency(tx.amount)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {viewMode === 'todo' && sheetTodos.length === 0 && (
              <View style={{ alignItems: 'center', paddingTop: 90 }}>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 16 }}>일정이 없습니다</Text>
              </View>
            )}

            {viewMode === 'finance' && sheetTransactions.length === 0 && sheetIncome === 0 && sheetExpense === 0 && (
              <View style={{ alignItems: 'center', paddingTop: 90 }}>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 16 }}>일정이 없습니다</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </Modal>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        {/* FAB 메뉴 Modal */}
        <Modal visible={fabOpen} transparent animationType="fade" onRequestClose={toggleFab}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={toggleFab}>
            <View style={[fabStyles.menuContainer, { bottom: fabBottomOffset }]}>
              <TouchableOpacity
                onPress={handleAddTransaction}
                activeOpacity={0.85}
                style={fabStyles.menuRow}
              >
                <View style={fabStyles.menuLabel}>
                  <Text style={fabStyles.menuLabelText}>가계부 추가</Text>
                </View>
                <View style={fabStyles.menuIcon}>
                  <Text style={fabStyles.menuIconGlyph}>₩</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleAddTodo}
                activeOpacity={0.85}
                style={fabStyles.menuRow}
              >
                <View style={fabStyles.menuLabel}>
                  <Text style={fabStyles.menuLabelText}>일정 추가</Text>
                </View>
                <View style={fabStyles.menuIcon}>
                  <Text style={fabStyles.menuIconGlyph}>+</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={toggleFab} activeOpacity={0.85} style={fabStyles.closeFab}>
                <Text style={fabStyles.closeFabText}>✕</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 메인 FAB: 탭바 버튼이 아니라 캘린더 화면 위 오버레이 */}
        <TouchableOpacity
          onPress={toggleFab}
          activeOpacity={0.85}
          style={[fabStyles.mainFab, { bottom: fabBottomOffset }]}
        >
          <Text style={fabStyles.mainFabText}>+</Text>
        </TouchableOpacity>
      </View>
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
  color,
  isLast,
  onToggle,
  onDrop,
  onDragStateChange,
}: {
  todo: Todo;
  fromDate: string;
  color?: string;
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

  const isCompleted = todo.status === 'completed';
  const textColor = color ?? '#ffffff';

  return (
    <Animated.View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderBottomWidth: !isLast ? 1 : 0,
        borderBottomColor: 'rgba(255,255,255,0.08)',
        transform: pan.getTranslateTransform(),
        zIndex: isDragging ? 40 : 1,
        elevation: isDragging ? 12 : 0,
      }}
    >
      {/* 완료 체크 버튼 */}
      <TouchableOpacity
        onPress={onToggle}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          width: 20, height: 20, borderRadius: 10, borderWidth: 2,
          marginRight: 12, alignItems: 'center', justifyContent: 'center',
          backgroundColor: isCompleted ? textColor : 'transparent',
          borderColor: isCompleted ? textColor : 'rgba(255,255,255,0.35)',
        }}
      >
        {isCompleted && <Text style={{ color: '#fff', fontSize: 10, lineHeight: 12 }}>✓</Text>}
      </TouchableOpacity>

      {/* 할일 제목 */}
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontSize: 14,
          color: isCompleted ? 'rgba(255,255,255,0.35)' : textColor,
          textDecorationLine: isCompleted ? 'line-through' : 'none',
        }}
      >
        {todo.title}
      </Text>

      {/* 색상 점 */}
      <View
        style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: textColor,
          marginHorizontal: 8,
          opacity: isCompleted ? 0.4 : 1,
        }}
      />

      {/* 드래그 핸들 */}
      <View
        {...panResponder.panHandlers}
        style={{
          paddingHorizontal: 10, paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: 'rgba(255,255,255,0.1)',
        }}
      >
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>⋮⋮</Text>
      </View>
    </Animated.View>
  );
}

const fabStyles = StyleSheet.create({
  mainFab: {
    position: 'absolute',
    right: 18,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(82, 82, 82, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 120,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  mainFabText: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '500',
  },
  menuContainer: {
    position: 'absolute',
    right: 18,
    alignItems: 'flex-end',
    zIndex: 130,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  menuLabel: {
    minWidth: 160,
    backgroundColor: 'rgba(58, 58, 58, 0.96)',
    paddingHorizontal: 24,
    paddingVertical: 19,
    borderRadius: 30,
    marginRight: 12,
  },
  menuLabelText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  menuIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(58, 58, 58, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  menuIconGlyph: {
    color: '#34D399',
    fontSize: 24,
    fontWeight: '700',
  },
  closeFab: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(82, 82, 82, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  closeFabText: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '500',
  },
});
