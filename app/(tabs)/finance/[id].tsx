// 앱 화면/라우팅 로직: app/(tabs)/finance/[id].tsx
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert, RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFinanceStore } from '../../../src/stores/finance.store';
import { useCategoryStore } from '../../../src/stores/category.store';
import { useAssetStore } from '../../../src/stores/asset.store';
import { useAuthStore } from '../../../src/stores/auth.store';
import { Transaction, TransactionType, UpdateTransactionDto } from '../../../src/types';
import { formatCurrency } from '../../../src/utils/currency';
import { TRANSACTION_TYPE_LABELS } from '../../../src/utils/constants';
import { formatDisplayDate } from '../../../src/utils/date';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { transactionsByMonth, updateTransaction, deleteTransaction, fetchMonth } = useFinanceStore();
  const { getCategoriesByType, fetchCategories } = useCategoryStore();
  const { assets, fetchAssets } = useAssetStore();

  const transaction = Object.values(transactionsByMonth).flat().find(t => t.id === id);

  const [description, setDescription] = useState(transaction?.description ?? '');
  const [memo, setMemo]               = useState(transaction?.memo ?? '');
  const [categoryId, setCategoryId]   = useState(transaction?.category_id ?? null);
  const [assetId, setAssetId]         = useState(transaction?.asset_id ?? null);
  const [isSaving, setSaving]         = useState(false);
  const [refreshing, setRefreshing]   = useState(false);

  if (!transaction) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark items-center justify-center">
        <Text className="text-text-secondary">거래를 찾을 수 없습니다.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-primary">돌아가기</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isIncome  = transaction.type === 'income';
  const isExpense = transaction.type === 'expense';
  const amountColor = isIncome ? '#10B981' : isExpense ? '#EF4444' : '#F59E0B';
  const categories = getCategoriesByType(transaction.type as any);

  const handleRefresh = async () => {
    if (!user) return;
    const [year, month] = transaction.transaction_date.split('-').map(Number);
    setRefreshing(true);
    try {
      await Promise.all([
        fetchMonth(user.id, year, month, true),
        fetchCategories(user.id),
        fetchAssets(user.id),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: UpdateTransactionDto = {
        description: description.trim(),
        memo: memo.trim() || null,
        category_id: categoryId,
        asset_id: assetId,
      };
      await updateTransaction(id!, updates);
      router.back();
    } catch (e: any) {
      Alert.alert('저장 실패', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('거래 삭제', '이 거래를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTransaction(id!);
            router.back();
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
      <View className="flex-row items-center px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Text className="text-2xl text-text-primary dark:text-text-dark-primary">←</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-xl font-bold text-text-primary dark:text-text-dark-primary">
          거래 편집
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
        {/* 금액 표시 */}
        <View className="bg-white dark:bg-surface-dark rounded-2xl p-5 mb-4 items-center">
          <Text className="text-xs text-text-secondary mb-2">
            {TRANSACTION_TYPE_LABELS[transaction.type]} · {formatDisplayDate(transaction.transaction_date)}
          </Text>
          <Text className="text-4xl font-bold" style={{ color: amountColor }}>
            {isIncome ? '+' : isExpense ? '-' : ''}
            {formatCurrency(transaction.amount)}
          </Text>
        </View>

        {/* 내용 */}
        <View className="bg-white dark:bg-surface-dark rounded-2xl p-4 mb-4">
          <Text className="text-xs font-medium text-text-secondary mb-2">내용</Text>
          <TextInput
            className="text-base text-text-primary dark:text-text-dark-primary"
            placeholder="거래 내용"
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* 메모 */}
        <View className="bg-white dark:bg-surface-dark rounded-2xl p-4 mb-4">
          <Text className="text-xs font-medium text-text-secondary mb-2">메모</Text>
          <TextInput
            className="text-sm text-text-primary dark:text-text-dark-primary"
            placeholder="메모 추가"
            placeholderTextColor="#9CA3AF"
            value={memo}
            onChangeText={setMemo}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* 카테고리 */}
        {categories.length > 0 && (
          <View className="bg-white dark:bg-surface-dark rounded-2xl p-4 mb-4">
            <Text className="text-xs font-medium text-text-secondary mb-3">카테고리</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-x-2">
                <TouchableOpacity
                  className={`px-3 py-1.5 rounded-full border ${
                    categoryId === null ? 'bg-primary border-primary' : 'border-border'
                  }`}
                  onPress={() => setCategoryId(null)}
                >
                  <Text className={`text-xs ${categoryId === null ? 'text-white' : 'text-text-secondary'}`}>
                    미분류
                  </Text>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    className={`px-3 py-1.5 rounded-full border ${
                      categoryId === cat.id ? 'border-transparent' : 'border-border'
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

        {/* 자산 */}
        {assets.length > 0 && (
          <View className="bg-white dark:bg-surface-dark rounded-2xl p-4 mb-4">
            <Text className="text-xs font-medium text-text-secondary mb-3">자산</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-x-2">
                {assets.map((asset) => (
                  <TouchableOpacity
                    key={asset.id}
                    className={`px-3 py-1.5 rounded-full border ${
                      assetId === asset.id ? 'border-transparent' : 'border-border'
                    }`}
                    style={assetId === asset.id ? { backgroundColor: asset.color } : {}}
                    onPress={() => setAssetId(asset.id)}
                  >
                    <Text
                      style={{ fontSize: 12 }}
                      className={assetId === asset.id ? 'text-white font-medium' : 'text-text-secondary'}
                    >
                      {asset.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

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
