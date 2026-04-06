// API/도메인 서비스 로직: src/services/offline-sync-manager.service.ts
import NetInfo, { NetInfoSubscription } from '@react-native-community/netinfo';
import { featureFlagService } from './feature-flag.service';
import { offlineQueueService } from './offline-queue.service';
import { opsLogService } from './ops-log.service';
import { todoService } from './todo.service';
import { financeService } from './finance.service';
import { todoParticipantService } from './todo-participant.service';
import { useTodoStore } from '../stores/todo.store';
import { useFinanceStore } from '../stores/finance.store';
import { useUIStore } from '../stores/ui.store';
import { OfflineQueueItem } from '../types/offline';

// 네트워크 단절로 간주할 오류 패턴
function isLikelyNetworkError(error: unknown) {
  const message = String((error as any)?.message ?? error ?? '').toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('timeout')
  );
}

// 권한/제약 위반으로 간주할 오류 패턴(자동 재시도보다 충돌 전환이 유리)
function isLikelyConflictError(error: unknown) {
  const message = String((error as any)?.message ?? error ?? '').toLowerCase();
  return (
    message.includes('row-level security') ||
    message.includes('permission denied') ||
    message.includes('violates') ||
    message.includes('constraint')
  );
}

class OfflineSyncManager {
  // 현재 로그인 사용자 기준으로만 큐를 처리합니다.
  private userId: string | null = null;
  // 네트워크 복구 감지를 위한 구독 핸들
  private netUnsubscribe: NetInfoSubscription | null = null;
  // 중복 flush(동시 실행) 방지 플래그
  private isFlushing = false;

  // 앱 로그인/세션 복구 시 호출: 즉시 flush + 네트워크 리스너 등록
  async start(userId: string) {
    const { offlineSyncEnabled } = featureFlagService.get();
    if (!offlineSyncEnabled) return;

    this.userId = userId;
    this.stopListener();

    // 앱 진입 시 즉시 한 번 동기화 시도
    await this.flush();

    // 네트워크 복귀 시 자동 동기화
    this.netUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        void this.flush();
      }
    });

    await opsLogService.log('sync.start', { user_id: userId });
  }

  stop() {
    this.userId = null;
    this.stopListener();
  }

  // 기존 리스너를 안전하게 해제합니다.
  private stopListener() {
    if (this.netUnsubscribe) {
      this.netUnsubscribe();
      this.netUnsubscribe = null;
    }
  }

  // 큐 처리 후 화면 캐시를 필요한 범위만 강제 새로고침합니다.
  private async refreshScope(item: OfflineQueueItem) {
    if (!this.userId) return;

    if (item.entity === 'todo') {
      const date = item.meta.date;
      if (date) {
        await useTodoStore.getState().fetchTodosForDate(this.userId, date, true);
      }
      return;
    }

    if (item.entity === 'transaction') {
      const monthKey = item.meta.month_key;
      if (monthKey) {
        const [year, month] = monthKey.split('-').map(Number);
        await useFinanceStore.getState().fetchMonth(this.userId, year, month, true);
      }
    }
  }

  // 큐 항목 1건을 실제 서버 요청으로 실행합니다.
  private async processItem(item: OfflineQueueItem) {
    if (!this.userId) return;

    if (item.entity === 'todo') {
      if (item.action === 'create') {
        const created = await todoService.create(item.payload as any);
        // 오프라인 할일 생성 시 선택했던 참여자를 서버 생성 이후 복원합니다.
        const participantIds = Array.isArray(item.meta.participant_ids)
          ? item.meta.participant_ids
          : [];
        if (item.meta.owner_id && participantIds.length > 0) {
          await todoParticipantService.replaceParticipants(
            created.id,
            item.meta.owner_id,
            participantIds
          );
        }
        if (item.meta.local_id) {
          await offlineQueueService.replaceTargetId(this.userId, 'todo', item.meta.local_id, created.id);
        }
      } else if (item.action === 'update' && item.target_id) {
        await todoService.update(item.target_id, item.payload as any);
      } else if (item.action === 'delete' && item.target_id) {
        await todoService.delete(item.target_id);
      }
      return;
    }

    if (item.entity === 'transaction') {
      if (item.action === 'create') {
        const created = await financeService.create(item.payload as any);
        if (item.meta.local_id) {
          await offlineQueueService.replaceTargetId(this.userId, 'transaction', item.meta.local_id, created.id);
        }
      } else if (item.action === 'update' && item.target_id) {
        await financeService.update(item.target_id, item.payload as any);
      } else if (item.action === 'delete' && item.target_id) {
        await financeService.delete(item.target_id);
      }
    }
  }

  async flush() {
    // 로그인 사용자가 없거나 이미 flush 중이면 스킵합니다.
    if (!this.userId || this.isFlushing) return;

    const { syncConflictRetryLimit } = featureFlagService.get();
    this.isFlushing = true;
    try {
      const queue = await offlineQueueService.list(this.userId);
      if (queue.length === 0) return;

      await opsLogService.log('sync.flush.start', {
        user_id: this.userId,
        queue_size: queue.length,
      });

      // 처리 성공 건수를 사용자 안내 배너에 활용합니다.
      let syncedCount = 0;
      for (const item of queue) {
        try {
          await this.processItem(item);
          await offlineQueueService.removeById(item.id);
          await this.refreshScope(item);
          syncedCount += 1;
        } catch (error) {
          // 실패는 attempts 증가 후 오류 유형에 따라 분기합니다.
          await offlineQueueService.markAttempt(item.id);
          const isNetwork = isLikelyNetworkError(error);
          const isConflict = isLikelyConflictError(error);

          await opsLogService.log('sync.item.failed', {
            queue_item_id: item.id,
            entity: item.entity,
            action: item.action,
            attempts: item.attempts + 1,
            reason: String((error as any)?.message ?? error ?? 'unknown'),
            network: isNetwork,
          }, isNetwork ? 'warn' : 'error');

          // 네트워크 오류는 지금 더 진행해도 연속 실패 가능성이 높아 루프를 중단합니다.
          if (isNetwork) break;

          // 권한/제약 오류 또는 재시도 한계 초과는 "충돌"로 분리 보관합니다.
          const attempts = item.attempts + 1;
          if (isConflict || attempts >= syncConflictRetryLimit) {
            await offlineQueueService.pushConflict({
              queue_item_id: item.id,
              user_id: item.user_id,
              entity: item.entity,
              action: item.action,
              reason: String((error as any)?.message ?? error ?? 'unknown'),
              payload: item.payload,
              meta: item.meta,
            });
            await offlineQueueService.removeById(item.id);
          }
        }
      }

      if (syncedCount > 0) {
        // 사용자에게 "데이터 유실 없이 반영되었다"는 피드백을 제공합니다.
        useUIStore.getState().showInAppNotice('오프라인 동기화 완료', `${syncedCount}건을 서버에 반영했습니다.`);
      }

      await opsLogService.log('sync.flush.done', {
        user_id: this.userId,
        synced_count: syncedCount,
      });
    } finally {
      this.isFlushing = false;
    }
  }
}

export const offlineSyncManager = new OfflineSyncManager();
