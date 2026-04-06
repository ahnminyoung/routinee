import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Share, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/auth.store';
import { useSubscriptionStore } from '../../src/stores/subscription.store';
import { financeService } from '../../src/services/finance.service';
import { Transaction } from '../../src/types';

function toCsvValue(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(rows: Transaction[]) {
  const header = ['날짜', '유형', '설명', '금액', '메모'];
  const lines = rows.map((tx) => [
    tx.transaction_date,
    tx.type,
    tx.description,
    tx.amount,
    tx.memo ?? '',
  ].map(toCsvValue).join(','));
  return [header.map(toCsvValue).join(','), ...lines].join('\n');
}

function getMonthOffset(base: Date, offset: number) {
  return new Date(base.getFullYear(), base.getMonth() + offset, 1);
}

export default function ReportExportModal() {
  const { user } = useAuthStore();
  const { isPro, fetchSubscription } = useSubscriptionStore();
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user) return;
    void fetchSubscription(user.id);
  }, [user, fetchSubscription]);

  const handleExport = async (months: number) => {
    if (!user) {
      Alert.alert('로그인 필요', '리포트를 내보내려면 로그인이 필요합니다.');
      return;
    }

    setExporting(true);
    try {
      const all: Transaction[] = [];
      const base = new Date();

      for (let i = 0; i < months; i += 1) {
        const date = getMonthOffset(base, -i);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const list = await financeService.fetchByMonth(user.id, year, month);
        all.push(...list);
      }

      const uniqueRows = Array.from(new Map(all.map((tx) => [tx.id, tx])).values())
        .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

      if (uniqueRows.length === 0) {
        Alert.alert('내보낼 데이터 없음', '선택한 기간에 거래 내역이 없습니다.');
        return;
      }

      const csv = buildCsv(uniqueRows);
      await Share.share({
        title: 'Routinee 거래 리포트',
        message: csv,
      });
    } catch (e: any) {
      Alert.alert('내보내기 실패', e?.message ?? '리포트 내보내기에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      <View className="items-center pt-3 pb-1">
        <View className="w-10 h-1 bg-border dark:bg-border-dark rounded-full" />
      </View>
      <View className="flex-row items-center px-5 py-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-primary">닫기</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold text-text-primary dark:text-text-dark-primary">
          리포트 내보내기
        </Text>
        <View className="w-10" />
      </View>

      {!isPro ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-4">🔒</Text>
          <Text className="text-text-primary dark:text-text-dark-primary text-lg font-bold">
            Pro 전용 기능
          </Text>
          <Text className="text-text-secondary text-sm mt-2 text-center">
            리포트 내보내기(CSV)는 Routinee Pro에서 사용할 수 있어요.
          </Text>
          <TouchableOpacity
            className="mt-5 bg-primary px-5 py-3 rounded-2xl"
            onPress={() => router.push('/(tabs)/settings/subscription')}
          >
            <Text className="text-white font-semibold">Routinee Pro 보기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView className="flex-1 px-5 py-4">
          <View className="bg-white dark:bg-surface-dark rounded-2xl p-4 mb-4">
            <Text className="text-sm font-semibold text-text-primary dark:text-text-dark-primary mb-2">
              내보내기 형식
            </Text>
            <Text className="text-xs text-text-secondary">
              CSV 텍스트를 공유 시트로 전달합니다. 노션/엑셀/메모앱 등에 붙여넣어 사용할 수 있어요.
            </Text>
          </View>

          <TouchableOpacity
            className={`rounded-2xl p-4 mb-3 ${exporting ? 'bg-primary/60' : 'bg-primary'}`}
            disabled={exporting}
            onPress={() => handleExport(1)}
          >
            <Text className="text-white text-base font-semibold">이번 달 CSV 내보내기</Text>
            <Text className="text-white/85 text-xs mt-1">현재 월의 수입/지출/이체 내역</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`rounded-2xl p-4 ${exporting ? 'bg-primary/60' : 'bg-primary'}`}
            disabled={exporting}
            onPress={() => handleExport(3)}
          >
            <Text className="text-white text-base font-semibold">최근 3개월 CSV 내보내기</Text>
            <Text className="text-white/85 text-xs mt-1">최근 3개월 거래를 합쳐서 내보냅니다</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
