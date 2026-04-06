// 앱 화면/라우팅 로직: app/(tabs)/settings/ops.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../../src/stores/auth.store';
import { offlineQueueService } from '../../../src/services/offline-queue.service';
import { opsLogService } from '../../../src/services/ops-log.service';
import { featureFlagService } from '../../../src/services/feature-flag.service';
import { OfflineQueueItem, SyncConflict } from '../../../src/types/offline';

// opsLogService.list() 반환 타입을 화면에서 재사용하기 위한 별칭
type OpsEvent = Awaited<ReturnType<typeof opsLogService.list>>[number];

export default function OpsDiagnosticsScreen() {
  const { user } = useAuthStore();
  const flags = featureFlagService.get();
  const [refreshing, setRefreshing] = useState(false);
  const [queueItems, setQueueItems] = useState<OfflineQueueItem[]>([]);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [events, setEvents] = useState<OpsEvent[]>([]);

  // 진단 화면 진입/당겨서 새로고침 시 큐/충돌/로그를 한 번에 갱신합니다.
  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const [queue, syncConflicts, logEvents] = await Promise.all([
        offlineQueueService.list(user.id),
        offlineQueueService.listConflicts(user.id),
        opsLogService.list(),
      ]);
      setQueueItems(queue);
      setConflicts(syncConflicts);
      // 최신 로그를 위로 보여주기 위해 reverse 후 최근 20건만 노출합니다.
      setEvents(logEvents.slice().reverse().slice(0, 20));
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // 상단 카드에서 빠르게 보여줄 요약 수치
  const summary = useMemo(() => ({
    queue: queueItems.length,
    conflicts: conflicts.length,
    events: events.length,
  }), [queueItems.length, conflicts.length, events.length]);

  // 로컬 진단 로그 초기화(운영 데이터와는 별개)
  const handleClearLogs = async () => {
    Alert.alert('운영 로그 삭제', '로컬 운영 로그를 모두 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await opsLogService.clear();
          await load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-primary font-medium">뒤로</Text>
        </TouchableOpacity>
        <Text className="text-lg font-bold text-text-primary dark:text-text-dark-primary">
          동기화/운영 진단
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      >
        <View className="bg-white dark:bg-surface-dark rounded-2xl p-4 mb-4">
          <Text className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
            기능 플래그
          </Text>
          <Text className="text-xs text-text-secondary mt-2">
            OFFLINE_SYNC_ENABLED: {String(flags.offlineSyncEnabled)}
          </Text>
          <Text className="text-xs text-text-secondary mt-1">
            OPS_TELEMETRY_ENABLED: {String(flags.opsTelemetryEnabled)}
          </Text>
          <Text className="text-xs text-text-secondary mt-1">
            SYNC_CONFLICT_RETRY_LIMIT: {flags.syncConflictRetryLimit}
          </Text>
        </View>

        <View className="bg-white dark:bg-surface-dark rounded-2xl p-4 mb-4">
          <Text className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
            상태 요약
          </Text>
          <Text className="text-xs text-text-secondary mt-2">대기 큐: {summary.queue}건</Text>
          <Text className="text-xs text-text-secondary mt-1">충돌: {summary.conflicts}건</Text>
          <Text className="text-xs text-text-secondary mt-1">최근 로그: {summary.events}건</Text>
        </View>

        <View className="bg-white dark:bg-surface-dark rounded-2xl p-4 mb-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
              최근 이벤트
            </Text>
            <TouchableOpacity onPress={handleClearLogs}>
              <Text className="text-xs text-red-500 font-medium">로그 비우기</Text>
            </TouchableOpacity>
          </View>
          {events.length === 0 && (
            <Text className="text-xs text-text-secondary mt-3">기록된 이벤트가 없습니다.</Text>
          )}
          {events.map((event) => (
            <View key={event.id} className="mt-3 border border-border dark:border-border-dark rounded-xl p-3">
              <Text className="text-xs font-medium text-text-primary dark:text-text-dark-primary">
                [{event.level.toUpperCase()}] {event.name}
              </Text>
              <Text className="text-[11px] text-text-secondary mt-1">
                {new Date(event.created_at).toLocaleString('ko-KR')}
              </Text>
            </View>
          ))}
        </View>

        <View className="bg-white dark:bg-surface-dark rounded-2xl p-4">
          <Text className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
            동기화 충돌
          </Text>
          {conflicts.length === 0 && (
            <Text className="text-xs text-text-secondary mt-3">현재 충돌 항목이 없습니다.</Text>
          )}
          {conflicts.slice().reverse().slice(0, 10).map((item) => (
            <View key={item.id} className="mt-3 border border-border dark:border-border-dark rounded-xl p-3">
              <Text className="text-xs font-medium text-text-primary dark:text-text-dark-primary">
                {item.entity}.{item.action}
              </Text>
              <Text className="text-[11px] text-red-500 mt-1">{item.reason}</Text>
              <Text className="text-[11px] text-text-secondary mt-1">
                {new Date(item.created_at).toLocaleString('ko-KR')}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
