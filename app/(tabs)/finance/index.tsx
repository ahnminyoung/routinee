import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl, Alert, SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../../src/stores/auth.store';
import { useFinanceStore } from '../../../src/stores/finance.store';
import { useAssetStore } from '../../../src/stores/asset.store';
import { useCategoryStore } from '../../../src/stores/category.store';
import { formatCurrency } from '../../../src/utils/currency';
import { formatMonth, formatDisplayDate } from '../../../src/utils/date';
import { Transaction } from '../../../src/types';
import { addMonths, subMonths } from 'date-fns';
import { useFinanceShareCount } from '../../../src/hooks/useFinanceShareCount';

export default function FinanceScreen() {
  const { user } = useAuthStore();
  const { getTransactionsForMonth, getSummaryForMonth, fetchMonth, deleteTransaction } = useFinanceStore();
  const { assets, fetchAssets, totalBalance } = useAssetStore();
  const { sharedCount, isShared } = useFinanceShareCount(user?.id);
  const [refreshing, setRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const transactions = getTransactionsForMonth(year, month);
  const summary      = getSummaryForMonth(year, month);

  const loadData = useCallback(async (force = false) => {
    if (!user) return;
    try {
      await Promise.all([
        fetchMonth(user.id, year, month, force),
        fetchAssets(user.id),
      ]);
    } catch (error) {
      console.warn('[FinanceScreen] 데이터 조회에 실패했습니다.', error);
    }
  }, [user, year, month, fetchMonth, fetchAssets]);

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

  // 날짜별 그룹핑
  const grouped = transactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const date = tx.transaction_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(tx);
    return acc;
  }, {});
  const sections = Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, data]) => ({ title: date, data }));

  const handleDelete = (tx: Transaction) => {
    Alert.alert('거래 삭제', `"${tx.description}"을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTransaction(tx.id);
          } catch (e: any) {
            Alert.alert('삭제 실패', e?.message ?? '거래 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      {/* 헤더 */}
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-text-primary dark:text-text-dark-primary">
            가계부
          </Text>
          {isShared && (
            <Text className="text-xs text-primary mt-1 font-semibold">
              공유 중 · {sharedCount}명
            </Text>
          )}
        </View>
        <View className="flex-row gap-x-3 items-center">
          <TouchableOpacity onPress={() => router.push('/(tabs)/finance/assets')}>
            <Text className="text-primary text-sm font-medium">자산</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-primary w-9 h-9 rounded-full items-center justify-center"
            onPress={() => router.push('/modals/add-transaction')}
          >
            <Text className="text-white text-xl leading-6">+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 월 네비게이션 */}
      <View className="flex-row items-center justify-between px-5 py-2">
        <TouchableOpacity onPress={() => setCurrentDate(subMonths(currentDate, 1))}>
          <Text className="text-text-primary dark:text-text-dark-primary text-xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-base font-semibold text-text-primary dark:text-text-dark-primary">
          {formatMonth(currentDate)}
        </Text>
        <TouchableOpacity onPress={() => setCurrentDate(addMonths(currentDate, 1))}>
          <Text className="text-text-primary dark:text-text-dark-primary text-xl">›</Text>
        </TouchableOpacity>
      </View>

      {/* 월별 요약 카드 */}
      <View className="mx-5 mb-4">
        <View className="bg-white dark:bg-surface-dark rounded-2xl p-4">
          <View className="flex-row justify-around">
            <SummaryItem
              label="수입"
              amount={summary.total_income}
              color="#10B981"
              sign="+"
            />
            <View className="w-px bg-border dark:bg-border-dark" />
            <SummaryItem
              label="지출"
              amount={summary.total_expense}
              color="#EF4444"
              sign="-"
            />
            <View className="w-px bg-border dark:bg-border-dark" />
            <SummaryItem
              label="잔액"
              amount={summary.net_balance}
              color={summary.net_balance >= 0 ? '#6366F1' : '#EF4444'}
            />
          </View>
        </View>
      </View>

      {/* 자산 카드 가로 스크롤 */}
      {assets.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="max-h-24"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
        >
          {assets.map((asset) => (
            <View
              key={asset.id}
              className="bg-white dark:bg-surface-dark rounded-2xl px-4 py-3 min-w-36"
            >
              <Text className="text-xs text-text-secondary mb-1">{asset.name}</Text>
              <Text
                className="text-base font-bold"
                style={{ color: asset.color }}
              >
                {formatCurrency(asset.current_balance)}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* 거래 목록 */}
      {sections.length === 0 ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <Text className="text-5xl mb-4">💸</Text>
          <Text className="text-text-secondary dark:text-text-dark-secondary text-base">
            이번 달 거래 내역이 없습니다
          </Text>
          <TouchableOpacity
            className="mt-4 bg-primary px-6 py-2.5 rounded-full"
            onPress={() => router.push('/modals/add-transaction')}
          >
            <Text className="text-white font-semibold">거래 추가</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section: { title, data } }) => {
            const dayIncome  = data.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
            const dayExpense = data.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
            return (
              <View className="flex-row items-center px-5 py-2 mt-2">
                <Text className="text-sm font-semibold text-text-primary dark:text-text-dark-primary flex-1">
                  {formatDisplayDate(title)}
                </Text>
                {dayIncome > 0 && (
                  <Text className="text-xs text-income mr-2">+{formatCurrency(dayIncome)}</Text>
                )}
                {dayExpense > 0 && (
                  <Text className="text-xs text-expense">-{formatCurrency(dayExpense)}</Text>
                )}
              </View>
            );
          }}
          renderItem={({ item, index, section }) => (
            <View className="mx-5">
              <TransactionItem
                transaction={item}
                isFirst={index === 0}
                isLast={index === section.data.length - 1}
                onPress={() => router.push(`/(tabs)/finance/${item.id}`)}
                onDelete={() => handleDelete(item)}
              />
            </View>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={{ paddingBottom: 20 }}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

function SummaryItem({ label, amount, color, sign }: {
  label: string; amount: number; color: string; sign?: string;
}) {
  return (
    <View className="items-center px-4">
      <Text className="text-xs text-text-secondary mb-1">{label}</Text>
      <Text className="text-base font-bold" style={{ color }}>
        {sign}{formatCurrency(Math.abs(amount))}
      </Text>
    </View>
  );
}

function TransactionItem({ transaction, isFirst, isLast, onPress, onDelete }: {
  transaction: Transaction;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const isIncome  = transaction.type === 'income';
  const isExpense = transaction.type === 'expense';
  const amountColor = isIncome ? '#10B981' : isExpense ? '#EF4444' : '#F59E0B';
  const amountSign  = isIncome ? '+' : isExpense ? '-' : '';

  return (
    <TouchableOpacity
      className={`flex-row items-center bg-white dark:bg-surface-dark px-4 py-3.5 ${
        isFirst ? 'rounded-t-2xl' : ''
      } ${
        isLast ? 'rounded-b-2xl mb-1' : 'border-b border-border dark:border-border-dark'
      }`}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* 카테고리 아이콘 영역 */}
      <View className="w-9 h-9 rounded-full bg-surface-secondary dark:bg-surface-dark-secondary items-center justify-center mr-3">
        <Text className="text-lg">
          {isIncome ? '💰' : isExpense ? '💳' : '🔄'}
        </Text>
      </View>

      <View className="flex-1">
        <Text className="text-sm font-medium text-text-primary dark:text-text-dark-primary" numberOfLines={1}>
          {transaction.description}
        </Text>
        {transaction.memo && (
          <Text className="text-xs text-text-secondary mt-0.5" numberOfLines={1}>
            {transaction.memo}
          </Text>
        )}
      </View>

      <Text className="text-sm font-bold mr-3" style={{ color: amountColor }}>
        {amountSign}{formatCurrency(transaction.amount)}
      </Text>

      <TouchableOpacity
        onPress={onDelete}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text className="text-text-secondary">×</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
