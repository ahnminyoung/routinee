import { create } from 'zustand';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Transaction, CreateTransactionDto, UpdateTransactionDto, MonthlySummary, CategorySpending } from '../types';
import { financeService } from '../services/finance.service';
import { sendSharedFinancePushOnCreate } from '../services/notification.service';

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

function dedupeTransactionsById(transactions: Transaction[]): Transaction[] {
  const seen = new Set<string>();
  return transactions.filter((tx) => {
    if (seen.has(tx.id)) return false;
    seen.add(tx.id);
    return true;
  });
}

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
        // 합계 캐시 무효화
        lastFetched: { ...state.lastFetched, [key]: 0 },
      };
    });
    return tx;
  },

  updateTransaction: async (id, updates) => {
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
  },

  deleteTransaction: async (id) => {
    await financeService.delete(id);
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
  },

  moveToDate: async (id, newDate) => {
    const updated = await financeService.moveToDate(id, newDate);
    set((state) => {
      const newByMonth = { ...state.transactionsByMonth };
      const touchedKeys: string[] = [];
      // 기존 위치에서 제거
      for (const key in newByMonth) {
        const exists = newByMonth[key].some((t) => t.id === id);
        if (exists) touchedKeys.push(key);
        newByMonth[key] = newByMonth[key].filter((t) => t.id !== id);
      }
      // 새 날짜 월에 추가
      const [year, month] = newDate.split('-').map(Number);
      const key = monthKey(year, month);
      newByMonth[key] = [updated, ...(newByMonth[key] ?? [])];
      touchedKeys.push(key);
      return {
        transactionsByMonth: newByMonth,
        summaryByMonth: recalcSummaryByMonth(state.summaryByMonth, newByMonth, touchedKeys),
      };
    });
  },

  invalidateMonth: (year, month) => {
    const key = monthKey(year, month);
    set((state) => ({
      lastFetched: { ...state.lastFetched, [key]: 0 },
    }));
  },

  handleRealtimeEvent: (payload) => {
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
