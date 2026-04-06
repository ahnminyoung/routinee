// 앱 화면/라우팅 로직: app/modals/add-transaction.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/auth.store';
import { useFinanceStore } from '../../src/stores/finance.store';
import { useCategoryStore } from '../../src/stores/category.store';
import { useAssetStore } from '../../src/stores/asset.store';
import { CreateTransactionDto, TransactionType } from '../../src/types';
import { formatCurrency } from '../../src/utils/currency';
import { today } from '../../src/utils/date';

type EntryTransactionType = Extract<TransactionType, 'expense' | 'income'>;

const TYPES: { type: EntryTransactionType; label: string; color: string }[] = [
  { type: 'expense', label: '지출', color: '#EF4444' },
  { type: 'income',  label: '입금', color: '#10B981' },
];

const KEYPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['000', '0', '⌫'],
];

export default function AddTransactionModal() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { addTransaction } = useFinanceStore();
  const { getCategoriesByType } = useCategoryStore();
  const { assets } = useAssetStore();

  const [txType, setTxType]       = useState<EntryTransactionType>('expense');
  const [amountStr, setAmountStr] = useState('0');
  const [description, setDesc]    = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const defaultAssetId = useMemo(
    () => assets.find((asset) => asset.type === 'cash')?.id ?? assets[0]?.id ?? null,
    [assets]
  );
  const [assetId, setAssetId] = useState<string | null>(defaultAssetId);
  const [isSaving, setSaving]     = useState(false);

  const amount = parseInt(amountStr.replace(/[^0-9]/g, ''), 10) || 0;
  const categories = getCategoriesByType(txType);
  const activeColor = TYPES.find(t => t.type === txType)?.color ?? '#6366F1';

  useEffect(() => {
    if (!assetId && defaultAssetId) {
      setAssetId(defaultAssetId);
    }
  }, [assetId, defaultAssetId]);

  const handleKeypad = (key: string) => {
    if (key === '⌫') {
      setAmountStr(prev => prev.length <= 1 ? '0' : prev.slice(0, -1));
    } else if (key === '000') {
      setAmountStr(prev => prev === '0' ? '0' : prev + '000');
    } else {
      setAmountStr(prev => prev === '0' ? key : prev + key);
    }
  };

  const handleSave = async () => {
    if (amount === 0) {
      Alert.alert('입력 오류', '금액을 입력해주세요.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('입력 오류', '내용을 입력해주세요.');
      return;
    }
    if (!assetId) {
      Alert.alert('자산 없음', '거래를 기록할 기본 자산이 없습니다. 자산을 먼저 추가해주세요.');
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      const dto: CreateTransactionDto = {
        user_id: user.id,
        type: txType,
        amount,
        description: description.trim(),
        category_id: categoryId,
        asset_id: assetId,
        transaction_date: today(),
      };
      await addTransaction(dto);
      router.back();
    } catch (e: any) {
      Alert.alert('저장 실패', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      {/* 핸들 */}
      <View className="items-center pt-3 pb-1">
        <View className="w-10 h-1 bg-border dark:bg-border-dark rounded-full" />
      </View>

      {/* 닫기 버튼 */}
      <View className="flex-row items-center px-5 py-2">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-primary">취소</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold text-text-primary dark:text-text-dark-primary">
          거래 추가
        </Text>
        <View className="w-10" />
      </View>

      {/* 거래 유형 탭 */}
      <View className="flex-row mx-5 bg-surface-secondary dark:bg-surface-dark-secondary rounded-2xl p-1 mb-4">
        {TYPES.map(({ type, label }) => (
          <TouchableOpacity
            key={type}
            className={`flex-1 py-2.5 rounded-xl items-center ${txType === type ? 'bg-white dark:bg-surface-dark' : ''}`}
            onPress={() => setTxType(type)}
          >
            <Text
              className={`text-sm font-semibold ${
                txType === type ? 'text-text-primary dark:text-text-dark-primary' : 'text-text-secondary'
              }`}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 금액 표시 */}
      <View className="items-center py-4 px-5">
        <Text className="text-5xl font-bold" style={{ color: activeColor }}>
          {formatCurrency(amount)}
        </Text>
      </View>

      {/* 내용 입력 */}
      <View className="mx-5 mb-3">
        <TextInput
          className="border border-border dark:border-border-dark rounded-xl px-4 py-3 text-base text-text-primary dark:text-text-dark-primary"
          placeholder="내용을 입력하세요 (예: 스타벅스 아메리카노)"
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDesc}
        />
      </View>

      {/* 카테고리 */}
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="max-h-10 mb-3"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          <TouchableOpacity
            className={`px-3 py-1.5 rounded-full border ${categoryId === null ? 'bg-primary border-primary' : 'border-border'}`}
            onPress={() => setCategoryId(null)}
          >
            <Text className={`text-xs ${categoryId === null ? 'text-white' : 'text-text-secondary'}`}>
              미분류
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              className={`px-3 py-1.5 rounded-full border ${categoryId === cat.id ? 'border-transparent' : 'border-border'}`}
              style={categoryId === cat.id ? { backgroundColor: cat.color } : {}}
              onPress={() => setCategoryId(cat.id)}
            >
              <Text style={{ fontSize: 12 }} className={categoryId === cat.id ? 'text-white font-medium' : 'text-text-secondary'}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* 계산기 키패드 */}
      <View className="mx-5 mt-auto mb-4">
        {KEYPAD.map((row, rowIdx) => (
          <View key={rowIdx} className="flex-row gap-x-3 mb-3">
            {row.map((key) => (
              <TouchableOpacity
                key={key}
                className="flex-1 h-14 bg-surface-secondary dark:bg-surface-dark-secondary rounded-2xl items-center justify-center"
                onPress={() => handleKeypad(key)}
                activeOpacity={0.7}
              >
                <Text className="text-xl font-semibold text-text-primary dark:text-text-dark-primary">
                  {key}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <TouchableOpacity
          className={`h-14 rounded-2xl items-center justify-center ${isSaving ? 'opacity-60' : ''}`}
          style={{ backgroundColor: activeColor }}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text className="text-white text-lg font-bold">
            {isSaving ? '저장 중...' : '저장'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
