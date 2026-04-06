// API/도메인 서비스 로직: src/services/offline-queue.service.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineQueueItem, SyncConflict, SyncEntity } from '../types/offline';

// 오프라인 요청 큐(재시도 대상) 저장 키
const QUEUE_KEY = 'routinee:offline-queue:v1';
// 동기화 충돌(수동 확인 대상) 저장 키
const CONFLICT_KEY = 'routinee:sync-conflicts:v1';

// 저장 레코드 타임스탬프 표준 포맷
function nowIso() {
  return new Date().toISOString();
}

// 큐/충돌 항목에서 공통으로 쓰는 로컬 ID 생성기
function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readQueue(): Promise<OfflineQueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as OfflineQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: OfflineQueueItem[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

async function readConflicts(): Promise<SyncConflict[]> {
  const raw = await AsyncStorage.getItem(CONFLICT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SyncConflict[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeConflicts(items: SyncConflict[]) {
  await AsyncStorage.setItem(CONFLICT_KEY, JSON.stringify(items));
}

export const offlineQueueService = {
  // 오프라인 요청 1건을 큐에 적재합니다.
  enqueue: async (item: Omit<OfflineQueueItem, 'id' | 'attempts' | 'created_at' | 'updated_at'>) => {
    const queue = await readQueue();
    const next: OfflineQueueItem = {
      ...item,
      id: createId('q'),
      attempts: 0,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    queue.push(next);
    await writeQueue(queue);
    return next;
  },

  list: async (userId?: string) => {
    const queue = await readQueue();
    if (!userId) return queue;
    return queue.filter((item) => item.user_id === userId);
  },

  removeById: async (id: string) => {
    const queue = await readQueue();
    await writeQueue(queue.filter((item) => item.id !== id));
  },

  // 동기화 실패 시 재시도 카운트를 누적합니다.
  markAttempt: async (id: string) => {
    const queue = await readQueue();
    const next = queue.map((item) => {
      if (item.id !== id) return item;
      return {
        ...item,
        attempts: item.attempts + 1,
        updated_at: nowIso(),
      };
    });
    await writeQueue(next);
  },

  // 오프라인 create가 서버 create로 확정된 뒤, 후속 update/delete 대상 ID를 치환합니다.
  replaceTargetId: async (userId: string, entity: SyncEntity, fromId: string, toId: string) => {
    const queue = await readQueue();
    const next = queue.map((item) => {
      if (item.user_id !== userId || item.entity !== entity) return item;
      if (item.target_id !== fromId) return item;
      return {
        ...item,
        target_id: toId,
        updated_at: nowIso(),
      };
    });
    await writeQueue(next);
  },

  // 아직 서버에 없는 local 생성건의 payload를 수정해 최신 입력값으로 유지합니다.
  updateCreatePayload: async (
    userId: string,
    entity: SyncEntity,
    localId: string,
    patch: Record<string, unknown>
  ) => {
    const queue = await readQueue();
    const next = queue.map((item) => {
      if (item.user_id !== userId || item.entity !== entity || item.action !== 'create') return item;
      if (item.meta.local_id !== localId) return item;
      return {
        ...item,
        payload: { ...(item.payload as Record<string, unknown>), ...patch } as any,
        // 생성 payload에서 날짜가 바뀌면 동기화 후 강제 새로고침 범위도 함께 맞춰줍니다.
        meta: {
          ...item.meta,
          ...(entity === 'todo' && typeof patch.due_date === 'string'
            ? { date: patch.due_date }
            : {}),
          ...(entity === 'transaction' && typeof patch.transaction_date === 'string'
            ? {
                date: patch.transaction_date,
                month_key: patch.transaction_date.slice(0, 7),
              }
            : {}),
        },
        updated_at: nowIso(),
      };
    });
    await writeQueue(next);
  },

  // 생성 큐 메타정보(참여자/소유자/화면 갱신 힌트 등)를 보강합니다.
  updateCreateMeta: async (
    userId: string,
    entity: SyncEntity,
    localId: string,
    patch: Record<string, unknown>
  ) => {
    const queue = await readQueue();
    const next = queue.map((item) => {
      if (item.user_id !== userId || item.entity !== entity || item.action !== 'create') return item;
      if (item.meta.local_id !== localId) return item;
      return {
        ...item,
        meta: { ...item.meta, ...patch },
        updated_at: nowIso(),
      };
    });
    await writeQueue(next);
  },

  // local 임시 항목을 사용자가 삭제한 경우, 해당 항목 관련 큐 작업도 함께 제거합니다.
  removeLocalEntityOps: async (userId: string, entity: SyncEntity, localId: string) => {
    const queue = await readQueue();
    const next = queue.filter((item) => {
      if (item.user_id !== userId || item.entity !== entity) return true;
      if (item.meta.local_id === localId) return false;
      if (item.target_id === localId) return false;
      return true;
    });
    await writeQueue(next);
  },

  // 충돌 항목은 큐와 분리 저장해 사용자/개발자가 추후 진단할 수 있게 합니다.
  pushConflict: async (params: Omit<SyncConflict, 'id' | 'created_at'>) => {
    const conflicts = await readConflicts();
    const next: SyncConflict = {
      ...params,
      id: createId('conflict'),
      created_at: nowIso(),
    };
    conflicts.push(next);
    await writeConflicts(conflicts);
    return next;
  },

  listConflicts: async (userId?: string) => {
    const conflicts = await readConflicts();
    if (!userId) return conflicts;
    return conflicts.filter((item) => item.user_id === userId);
  },
};
