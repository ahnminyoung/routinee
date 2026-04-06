// 타입 정의: src/types/offline.ts
import { CreateTodoDto, CreateTransactionDto, UpdateTodoDto, UpdateTransactionDto } from './index';

// 오프라인 큐가 다루는 엔티티 범위
export type SyncEntity = 'todo' | 'transaction';
// 오프라인 큐가 다루는 동작 범위
export type SyncAction = 'create' | 'update' | 'delete';

// 엔티티/동작별 payload 타입 매핑
export type QueuePayloadByEntity = {
  todo: {
    create: CreateTodoDto;
    update: UpdateTodoDto;
    delete: { id: string };
  };
  transaction: {
    create: CreateTransactionDto;
    update: UpdateTransactionDto;
    delete: { id: string };
  };
};

export type QueueMeta = {
  // 로컬 임시 ID(오프라인 생성용)
  local_id?: string;
  // 화면 범위 캐시를 갱신하기 위한 힌트
  date?: string;           // YYYY-MM-DD
  month_key?: string;      // YYYY-MM
  // 오프라인 할일 생성 시 참여자 정보 보존용
  owner_id?: string;
  participant_ids?: string[];
  // 설명/디버깅용 라벨
  note?: string;
};

export interface OfflineQueueItem<
  E extends SyncEntity = SyncEntity,
  A extends SyncAction = SyncAction
> {
  // 큐 내부 식별자
  id: string;
  // 큐 항목 소유 사용자
  user_id: string;
  // todo | transaction
  entity: E;
  // create | update | delete
  action: A;
  // update/delete 대상 서버 ID(또는 local 임시 ID)
  target_id?: string;
  // 동작별 요청 payload
  payload: QueuePayloadByEntity[E][A];
  // 동기화/화면갱신/디버깅 힌트
  meta: QueueMeta;
  // 동기화 시도 횟수
  attempts: number;
  // 생성 시각
  created_at: string;
  // 마지막 변경 시각
  updated_at: string;
}

export interface SyncConflict {
  // 충돌 항목 식별자
  id: string;
  // 원본 큐 항목 ID
  queue_item_id: string;
  user_id: string;
  entity: SyncEntity;
  action: SyncAction;
  // 오류 원문 요약
  reason: string;
  // 재현/수동 해결을 위한 원본 payload
  payload: unknown;
  // 화면 갱신 범위/참여자 정보 등 메타
  meta: QueueMeta;
  // 충돌로 분리된 시각
  created_at: string;
}
