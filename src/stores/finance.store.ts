// 전역 상태 관리 로직: src/stores/finance.store.ts
import { create } from 'zustand';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Transaction, CreateTransactionDto, UpdateTransactionDto, MonthlySummary, CategorySpending } from '../types';
import { financeService } from '../services/finance.service';
import { sendSharedFinancePushOnCreate } from '../services/notification.service';
import { offlineQueueService } from '../services/offline-queue.service';
import { offlineSyncManager } from '../services/offline-sync-manager.service';
import { opsLogService } from '../services/ops-log.service';

// 네트워크 단절 계열 에러를 식별해 오프라인 큐 분기로 전환합니다.
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

// 서버 확정 전 로컬 임시 거래 ID 구분자
function isLocalId(id: string) {
  return id.startsWith('local-');
}

// 오프라인 생성 즉시 렌더링할 임시 거래 레코드를 구성합니다.
function createLocalTransaction(dto: CreateTransactionDto): Transaction {
  const now = new Date().toISOString();
  return {
    id: `local-tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    user_id: dto.user_id,
    type: dto.type,
    amount: dto.amount,
    description: dto.description,
    memo: dto.memo ?? null,
    category_id: dto.category_id ?? null,
    asset_id: dto.asset_id ?? null,
    to_asset_id: dto.to_asset_id ?? null,
    transaction_date: dto.transaction_date,
    transaction_time: dto.transaction_time ?? null,
    receipt_url: dto.receipt_url ?? null,
    receipt_ocr_data: dto.receipt_ocr_data ?? null,
    is_recurring: dto.is_recurring ?? false,
    recurrence_rule: dto.recurrence_rule ?? null,
    recurrence_parent_id: dto.recurrence_parent_id ?? null,
    linked_todo_id: dto.linked_todo_id ?? null,
    sort_order: dto.sort_order ?? 0,
    created_at: now,
    updated_at: now,
    deleted_at: dto.deleted_at ?? null,
  };
}

interface FinanceStore {
  transactionsByMonth: Record<string, Transaction[]>; // key: YYYY-MM
  summaryByMonth:      Record<string, MonthlySummary>;
  categorySpending:    Record<string, CategorySpending[]>;
  isLoading: boolean;
  lastFetched: Record<string, number>;

  // Selectors
  getTransactionsForMonth: (year: number, month: number) => Transaction[];
  getSummaryForMonth: (year: number, month: number) => MonthlySummary;
  getTransactionsForDate: (date: string) => Transaction[];

  // Actions
  fetchMonth: (userId: string, year: number, month: number, force?: boolean) => Promise<void>;
  fetchCategorySpending: (userId: string, year: number, month: number) => Promise<void>;
  addTransaction: (tx: CreateTransactionDto) => Promise<Transaction>;
  updateTransaction: (id: string, updates: UpdateTransactionDto) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  moveToDate: (id: string, newDate: string) => Promise<void>;
  handleRealtimeEvent: (payload: RealtimePostgresChangesPayload<Transaction>) => void;
  invalidateMonth: (year: number, month: number) => void;
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

const EMPTY_SUMMARY: MonthlySummary = { total_income: 0, total_expense: 0, net_balance: 0 };

// 실시간/동기화 중복 반영을 막기 위해 ID 기준 중복 제거
function dedupeTransactionsById(transactions: Transaction[]): Transaction[] {
  const seen = new Set<string>();
  return transactions.filter((tx) => {
    if (seen.has(tx.id)) return false;
    seen.add(tx.id);
    return true;
  });
}

// 월별 수입/지출/순잔액 계산
function calculateMonthlySummary(transactions: Transaction[]): MonthlySummary {
  const normalized = dedupeTransactionsById(transactions);
  const total_income = normalized
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const total_expense = normalized
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  return {
    total_income,
    total_expense,
    net_balance: total_income - total_expense,
  };
}

function recalcSummaryByMonth(
  summaryByMonth: Record<string, MonthlySummary>,
  transactionsByMonth: Record<string, Transaction[]>,
  keys: string[]
) {
  const nextSummary = { ...summaryByMonth };
  const uniqueKeys = Array.from(new Set(keys));
  uniqueKeys.forEach((key) => {
    nextSummary[key] = calculateMonthlySummary(transactionsByMonth[key] ?? []);
  });
  return nextSummary;
}

export const useFinanceStore = create<FinanceStore>((set, get) => ({
  transactionsByMonth: {},
  summaryByMonth: {},
  categorySpending: {},
  isLoading: false,
  lastFetched: {},

  getTransactionsForMonth: (year, month) =>
    dedupeTransactionsById(get().transactionsByMonth[monthKey(year, month)] ?? []),

  getSummaryForMonth: (year, month) =>
    get().summaryByMonth[monthKey(year, month)] ?? EMPTY_SUMMARY,

  getTransactionsForDate: (date) => {
    const [year, month] = date.split('-').map(Number);
    const key = monthKey(year, month);
    return dedupeTransactionsById(
      (get().transactionsByMonth[key] ?? []).filter((t) => t.transaction_date === date)
    );
  },

  fetchMonth: async (userId, year, month, force = false) => {
    const key = monthKey(year, month);
    const { lastFetched } = get();
    const now = Date.now();
    // 5분 캐시 유효 시간 내에는 네트워크 조회를 건너뜁니다.
    if (!force && lastFetched[key] && now - lastFetched[key] < 5 * 60 * 1000) return;

    set({ isLoading: true });
    try {
      const transactions = await financeService.fetchByMonth(userId, year, month);
      const normalized = dedupeTransactionsById(transactions);
      const summary = calculateMonthlySummary(normalized);
      set((state) => ({
        transactionsByMonth: { ...state.transactionsByMonth, [key]: normalized },
        summaryByMonth:      { ...state.summaryByMonth, [key]: summary },
        lastFetched:         { ...state.lastFetched, [key]: now },
      }));
    } catch (error) {
      console.warn('[FinanceStore] 월별 데이터 조회에 실패했습니다.', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchCategorySpending: async (userId, year, month) => {
    const key = monthKey(year, month);
    try {
      const data = await financeService.getCategorySpending(userId, year, month);
      set((state) => ({
        categorySpending: { ...state.categorySpending, [key]: data },
      }));
    } catch (error) {
      console.warn('[FinanceStore] 카테고리 지출 조회에 실패했습니다.', error);
    }
  },

  addTransaction: async (txDto) => {
    try {
      // 온라인이면 서버 생성 결과를 그대로 반영합니다.
      const tx = await financeService.create(txDto);
      void sendSharedFinancePushOnCreate(tx);
      const [year, month] = tx.transaction_date.split('-').map(Number);
      const key = monthKey(year, month);
      set((state) => {
        const nextByMonth = { ...state.transactionsByMonth };
        const touchedKeys: string[] = [];
        for (const monthKey in nextByMonth) {
          const exists = nextByMonth[monthKey].some((t) => t.id === tx.id);
          if (!exists) continue;
          touchedKeys.push(monthKey);
          nextByMonth[monthKey] = nextByMonth[monthKey].filter((t) => t.id !== tx.id);
        }
        nextByMonth[key] = [tx, ...(nextByMonth[key] ?? [])];
        touchedKeys.push(key);

        return {
          transactionsByMonth: nextByMonth,
          summaryByMonth: recalcSummaryByMonth(state.summaryByMonth, nextByMonth, touchedKeys),
          lastFetched: { ...state.lastFetched, [key]: 0 },
        };
      });
      return tx;
    } catch (error) {
      if (!isLikelyNetworkError(error)) throw error;

      // 오프라인 생성: 로컬 임시 거래를 먼저 렌더링하고, 서버 반영은 큐에 저장합니다.
      const localTx = createLocalTransaction(txDto);
      const [year, month] = localTx.transaction_date.split('-').map(Number);
      const key = monthKey(year, month);
      set((state) => {
        const nextByMonth = { ...state.transactionsByMonth };
        nextByMonth[key] = [localTx, ...(nextByMonth[key] ?? [])];
        return {
          transactionsByMonth: nextByMonth,
          summaryByMonth: recalcSummaryByMonth(state.summaryByMonth, nextByMonth, [key]),
          lastFetched: { ...state.lastFetched, [key]: 0 },
        };
      });

      await offlineQueueService.enqueue({
        user_id: txDto.user_id,
        entity: 'transaction',
        action: 'create',
        payload: txDto as any,
        meta: {
          local_id: localTx.id,
          date: localTx.transaction_date,
          month_key: key,
          note: 'offline-create-transaction',
        },
      });
      await opsLogService.log('transaction.offline.enqueued.create', {
        local_id: localTx.id,
        month_key: key,
      }, 'warn');
      void offlineSyncManager.flush();
      return localTx;
    }
  },

  updateTransaction: async (id, updates) => {
    // 현재 캐시에서 기준 거래를 찾아 낙관적 업데이트 값을 만듭니다.
    const all = Object.values(get().transactionsByMonth).flat();
    const current = all.find((t) => t.id === id);
    if (!current) return;

    const optimistic: Transaction = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (isLocalId(id)) {
      // local 생성건은 서버 update 대신 create payload를 갱신합니다.
      set((state) => {
        const next = { ...state.transactionsByMonth };
        const touchedKeys: string[] = [];
        for (const key in next) {
          const exists = next[key].some((t) => t.id === id);
          if (!exists) continue;
          touchedKeys.push(key);
          next[key] = next[key].filter((t) => t.id !== id);
        }
        const [yy, mm] = optimistic.transaction_date.split('-').map(Number);
        const targetKey = monthKey(yy, mm);
        touchedKeys.push(targetKey);
        next[targetKey] = [optimistic, ...(next[targetKey] ?? [])];
        return {
          transactionsByMonth: next,
          summaryByMonth: recalcSummaryByMonth(state.summaryByMonth, next, touchedKeys),
        };
      });
      await offlineQueueService.updateCreatePayload(current.user_id, 'transaction', id, updates as any);
      return;
    }

    try {
      // 온라인 수정 성공 시 최신 서버값으로 월 버킷 재배치
      const updated = await financeService.update(id, updates);
      set((state) => {
        const newByMonth = { ...state.transactionsByMonth };
        const touchedKeys: string[] = [];
        for (const key in newByMonth) {
          const exists = newByMonth[key].some((t) => t.id === id);
          if (!exists) continue;
          touchedKeys.push(key);
          newByMonth[key] = newByMonth[key].filter((t) => t.id !== id);
        }
        const [toYear, toMonth] = updated.transaction_date.split('-').map(Number);
        const toKey = monthKey(toYear, toMonth);
        newByMonth[toKey] = [updated, ...(newByMonth[toKey] ?? [])];
        touchedKeys.push(toKey);

        return {
          transactionsByMonth: newByMonth,
          summaryByMonth: recalcSummaryByMonth(state.summaryByMonth, newByMonth, touchedKeys),
        };
      });
    } catch (error) {
      if (!isLikelyNetworkError(error)) throw error;

      // 오프라인 수정: 로컬은 즉시 반영, 서버 수정은 큐에 저장합니다.
      set((state) => {
        const next = { ...state.transactionsByMonth };
        const touchedKeys: string[] = [];
        for (const key in next) {
          const exists = next[key].some((t) => t.id === id);
          if (!exists) continue;
          touchedKeys.push(key);
          next[key] = next[key].filter((t) => t.id !== id);
        }
        const [yy, mm] = optimistic.transaction_date.split('-').map(Number);
        const targetKey = monthKey(yy, mm);
        touchedKeys.push(targetKey);
        next[targetKey] = [optimistic, ...(next[targetKey] ?? [])];
        return {
          transactionsByMonth: next,
          summaryByMonth: recalcSummaryByMonth(state.summaryByMonth, next, touchedKeys),
        };
      });

      const [yy, mm] = optimistic.transaction_date.split('-').map(Number);
      const key = monthKey(yy, mm);
      await offlineQueueService.enqueue({
        user_id: current.user_id,
        entity: 'transaction',
        action: 'update',
        target_id: id,
        payload: updates as any,
        meta: {
          date: optimistic.transaction_date,
          month_key: key,
          note: 'offline-update-transaction',
        },
      });
      await opsLogService.log('transaction.offline.enqueued.update', {
        id,
        month_key: key,
      }, 'warn');
      void offlineSyncManager.flush();
    }
  },

  deleteTransaction: async (id) => {
    const all = Object.values(get().transactionsByMonth).flat();
    const current = all.find((t) => t.id === id);
    if (!current) return;

    // 화면 캐시에서 항목 제거 + 영향 월 요약 재계산 공통 처리
    const removeLocal = () => {
      set((state) => {
        const newByMonth = { ...state.transactionsByMonth };
        const touchedKeys: string[] = [];
        for (const key in newByMonth) {
          const found = newByMonth[key].find((t) => t.id === id);
          if (found) touchedKeys.push(key);
          newByMonth[key] = newByMonth[key].filter((t) => t.id !== id);
        }
        return {
          transactionsByMonth: newByMonth,
          summaryByMonth: recalcSummaryByMonth(state.summaryByMonth, newByMonth, touchedKeys),
          lastFetched: touchedKeys.length > 0
            ? touchedKeys.reduce((acc, key) => ({ ...acc, [key]: 0 }), { ...state.lastFetched })
            : state.lastFetched,
        };
      });
    };

    if (isLocalId(id)) {
      // 서버에 없는 local 항목은 큐 정리만으로 삭제 완료
      removeLocal();
      await offlineQueueService.removeLocalEntityOps(current.user_id, 'transaction', id);
      return;
    }

    try {
      await financeService.delete(id);
      removeLocal();
    } catch (error) {
      if (!isLikelyNetworkError(error)) throw error;
      removeLocal();

      const [yy, mm] = current.transaction_date.split('-').map(Number);
      await offlineQueueService.enqueue({
        user_id: current.user_id,
        entity: 'transaction',
        action: 'delete',
        target_id: id,
        payload: { id } as any,
        meta: {
          date: current.transaction_date,
          month_key: monthKey(yy, mm),
          note: 'offline-delete-transaction',
        },
      });
      await opsLogService.log('transaction.offline.enqueued.delete', { id }, 'warn');
      void offlineSyncManager.flush();
    }
  },

  moveToDate: async (id, newDate) => {
    try {
      // 날짜 이동은 updateTransaction 하나로 통합해 오프라인 처리도 동일하게 적용합니다.
      await get().updateTransaction(id, { transaction_date: newDate });
    } catch (error) {
      console.warn('[FinanceStore] 거래 날짜 이동에 실패했습니다.', error);
    }
  },

  invalidateMonth: (year, month) => {
    const key = monthKey(year, month);
    set((state) => ({
      lastFetched: { ...state.lastFetched, [key]: 0 },
    }));
  },

  handleRealtimeEvent: (payload) => {
    // 다른 디바이스/세션 변경을 현재 월 캐시에 병합합니다.
    set((state) => {
      const newByMonth = { ...state.transactionsByMonth };
      const touchedKeys: string[] = [];

      if (payload.eventType === 'INSERT') {
        const tx = payload.new as Transaction;
        const [year, month] = tx.transaction_date.split('-').map(Number);
        const key = monthKey(year, month);
        for (const existingKey in newByMonth) {
          const exists = newByMonth[existingKey].some((t) => t.id === tx.id);
          if (!exists) continue;
          touchedKeys.push(existingKey);
          newByMonth[existingKey] = newByMonth[existingKey].filter((t) => t.id !== tx.id);
        }
        newByMonth[key] = [tx, ...(newByMonth[key] ?? [])];
        touchedKeys.push(key);
      }

      if (payload.eventType === 'UPDATE') {
        const tx = payload.new as Transaction;
        for (const key in newByMonth) {
          const exists = newByMonth[key].some((t) => t.id === tx.id);
          if (!exists) continue;
          touchedKeys.push(key);
          newByMonth[key] = newByMonth[key].filter((t) => t.id !== tx.id);
        }
        const [year, month] = tx.transaction_date.split('-').map(Number);
        const targetKey = monthKey(year, month);
        newByMonth[targetKey] = [tx, ...(newByMonth[targetKey] ?? [])];
        touchedKeys.push(targetKey);
      }

      if (payload.eventType === 'DELETE') {
        const id = payload.old.id;
        for (const key in newByMonth) {
          const exists = newByMonth[key].some((t) => t.id === id);
          if (!exists) continue;
          touchedKeys.push(key);
          newByMonth[key] = newByMonth[key].filter((t) => t.id !== id);
        }
      }

      return {
        transactionsByMonth: newByMonth,
        summaryByMonth: recalcSummaryByMonth(state.summaryByMonth, newByMonth, touchedKeys),
      };
    });
  },
}));
