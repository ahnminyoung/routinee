import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../src/stores/auth.store';
import { useTodoStore } from '../../src/stores/todo.store';
import { useFinanceStore } from '../../src/stores/finance.store';
import { useAssetStore } from '../../src/stores/asset.store';
import { formatCurrency } from '../../src/utils/currency';
import { formatMonth, today } from '../../src/utils/date';
import { getDisplayName } from '../../src/utils/display-name';
import { PRIORITY_COLORS } from '../../src/utils/constants';
import { Todo, Transaction } from '../../src/types';
import { useFinanceShareCount } from '../../src/hooks/useFinanceShareCount';

export default function DashboardScreen() {
  const { user, profile } = useAuthStore();
  const { getTodayTodos, fetchTodosForDate, toggleComplete } = useTodoStore();
  const { getTransactionsForDate, getSummaryForMonth, fetchMonth } = useFinanceStore();
  const { totalBalance, ownBalance, fetchAssets } = useAssetStore();
  const { sharedCount, isShared } = useFinanceShareCount(user?.id);
  const [refreshing, setRefreshing] = useState(false);

  const todayStr = today();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const todayTodos = getTodayTodos();
  const todayTransactions = getTransactionsForDate(todayStr);
  const summary = getSummaryForMonth(year, month);
  const displayName = getDisplayName(user, profile, '루티니');

  const loadData = useCallback(async (force = false) => {
    if (!user) return;
    try {
      await Promise.all([
        fetchTodosForDate(user.id, todayStr, force),
        fetchMonth(user.id, year, month, force),
        fetchAssets(user.id),
      ]);
    } catch (error) {
      console.warn('[Dashboard] 초기 데이터 로딩에 실패했습니다.', error);
    }
  }, [user, todayStr, year, month, fetchTodosForDate, fetchMonth, fetchAssets]);

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

  const pendingTodos    = todayTodos.filter(t => t.status !== 'completed').slice(0, 5);
  const completedCount  = todayTodos.filter(t => t.status === 'completed').length;
  const completionRate  = todayTodos.length > 0
    ? Math.round((completedCount / todayTodos.length) * 100)
    : 0;

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* 헤더 */}
        <View className="px-5 pt-4 pb-2">
          <Text className="text-text-secondary dark:text-text-dark-secondary text-sm">
            {formatMonth(new Date())}
          </Text>
          <Text className="text-2xl font-bold text-text-primary dark:text-text-dark-primary">
            안녕하세요, {displayName}님 👋
          </Text>
          {isShared && (
            <View className="self-start mt-2 px-3 py-1 rounded-full bg-primary/15">
              <Text className="text-xs font-semibold text-primary">
                가계부 공유 중 · {sharedCount}명
              </Text>
            </View>
          )}
        </View>

        {/* 총 자산 카드 */}
        <View className="mx-5 mt-4 bg-primary rounded-3xl p-5">
          <View className="flex-row items-end justify-between">
            <View className="flex-1">
              <Text className="text-white/80 text-sm mb-1">총 자산 (공유 포함)</Text>
              <Text className="text-white text-3xl font-bold">
                {formatCurrency(totalBalance)}
              </Text>
            </View>
            <View className="items-end ml-4">
              <Text className="text-white/70 text-xs mb-1">개인 자산</Text>
              <Text className="text-white text-lg font-semibold">
                {formatCurrency(ownBalance)}
              </Text>
            </View>
          </View>
          <View className="flex-row mt-4 gap-x-4">
            <View>
              <Text className="text-white/70 text-xs">이번 달 수입</Text>
              <Text className="text-income text-base font-semibold">
                +{formatCurrency(summary.total_income)}
              </Text>
            </View>
            <View>
              <Text className="text-white/70 text-xs">이번 달 지출</Text>
              <Text className="text-expense text-base font-semibold">
                -{formatCurrency(summary.total_expense)}
              </Text>
            </View>
          </View>
        </View>

        {/* 오늘의 할일 */}
        <View className="mx-5 mt-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-text-primary dark:text-text-dark-primary">
              오늘의 할일
            </Text>
            <Text className="text-sm text-text-secondary dark:text-text-dark-secondary">
              {completedCount}/{todayTodos.length} 완료
            </Text>
          </View>

          {/* 진행률 바 */}
          {todayTodos.length > 0 && (
            <View className="h-2 bg-border dark:bg-border-dark rounded-full mb-3">
              <View
                className="h-2 bg-primary rounded-full"
                style={{ width: `${completionRate}%` }}
              />
            </View>
          )}

          {pendingTodos.length === 0 ? (
            <View className="bg-white dark:bg-surface-dark rounded-2xl p-5 items-center">
              <Text className="text-3xl mb-2">🎉</Text>
              <Text className="text-text-secondary dark:text-text-dark-secondary text-sm">
                {todayTodos.length === 0
                  ? '오늘 할일이 없습니다!'
                  : '오늘 할일을 모두 완료했습니다!'}
              </Text>
            </View>
          ) : (
            <View className="bg-white dark:bg-surface-dark rounded-2xl overflow-hidden">
              {pendingTodos.map((todo, index) => (
                <DashboardTodoItem
                  key={todo.id}
                  todo={todo}
                  isLast={index === pendingTodos.length - 1}
                  onToggle={() => toggleComplete(todo.id)}
                />
              ))}
            </View>
          )}
        </View>

        {/* 오늘 거래 */}
        {todayTransactions.length > 0 && (
          <View className="mx-5 mt-5">
            <Text className="text-lg font-bold text-text-primary dark:text-text-dark-primary mb-3">
              오늘 거래
            </Text>
            <View className="bg-white dark:bg-surface-dark rounded-2xl overflow-hidden">
              {todayTransactions.slice(0, 5).map((tx, index) => (
                <DashboardTransactionItem
                  key={tx.id}
                  transaction={tx}
                  isLast={index === Math.min(todayTransactions.length - 1, 4)}
                />
              ))}
            </View>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

function DashboardTodoItem({
  todo, isLast, onToggle,
}: { todo: Todo; isLast: boolean; onToggle: () => void }) {
  const isCompleted = todo.status === 'completed';
  return (
    <TouchableOpacity
      className={`flex-row items-center px-4 py-3.5 ${!isLast ? 'border-b border-border dark:border-border-dark' : ''}`}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View
        className={`w-6 h-6 rounded-full border-2 mr-3 items-center justify-center ${
          isCompleted ? 'bg-primary border-primary' : 'border-border dark:border-border-dark'
        }`}
      >
        {isCompleted && <Text className="text-white text-xs">✓</Text>}
      </View>
      <View className="flex-1">
        <Text
          className={`text-sm ${isCompleted
            ? 'text-text-secondary line-through'
            : 'text-text-primary dark:text-text-dark-primary'
          }`}
          numberOfLines={1}
        >
          {todo.title}
        </Text>
      </View>
      <View
        className="w-2 h-2 rounded-full ml-2"
        style={{ backgroundColor: PRIORITY_COLORS[todo.priority ?? 'medium'] }}
      />
    </TouchableOpacity>
  );
}

function DashboardTransactionItem({
  transaction, isLast,
}: { transaction: Transaction; isLast: boolean }) {
  const isIncome  = transaction.type === 'income';
  const isExpense = transaction.type === 'expense';
  return (
    <View
      className={`flex-row items-center px-4 py-3.5 ${!isLast ? 'border-b border-border dark:border-border-dark' : ''}`}
    >
      <View className="flex-1">
        <Text className="text-sm text-text-primary dark:text-text-dark-primary" numberOfLines={1}>
          {transaction.description}
        </Text>
      </View>
      <Text
        className={`text-sm font-semibold ${
          isIncome ? 'text-income' : isExpense ? 'text-expense' : 'text-transfer'
        }`}
      >
        {isIncome ? '+' : isExpense ? '-' : ''}
        {formatCurrency(transaction.amount)}
      </Text>
    </View>
  );
}
