// API/도메인 서비스 로직: src/services/finance.service.ts
import { supabase } from './supabase';
import { CreateTransactionDto, UpdateTransactionDto, Transaction, MonthlySummary, CategorySpending } from '../types';
import {
  isMissingFunctionError,
  isMissingTableError,
  toUserFacingSupabaseError,
} from './supabase-error';

const db = supabase as any;

export const financeService = {
  fetchByMonth: async (_userId: string, year: number, month: number): Promise<Transaction[]> => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate   = new Date(year, month, 0).toISOString().split('T')[0];

    const { data, error } = await db
      .from('transactions')
      // transactions.asset_id / to_asset_id 두 FK가 모두 assets를 가리켜서
      // 임베드 시 FK를 명시하지 않으면 PostgREST가 모호성 오류를 반환합니다.
      .select(`
        *,
        categories(*),
        asset:assets!transactions_asset_id_fkey(*),
        to_asset:assets!transactions_to_asset_id_fkey(*)
      `)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .is('deleted_at', null)
      .order('transaction_date', { ascending: false })
      .order('sort_order', { ascending: true });
    if (error) {
      if (isMissingTableError(error)) return [];
      throw toUserFacingSupabaseError(error, '거래');
    }
    return data ?? [];
  },

  fetchByDate: async (_userId: string, date: string): Promise<Transaction[]> => {
    const { data, error } = await db
      .from('transactions')
      .select(`
        *,
        categories(*),
        asset:assets!transactions_asset_id_fkey(*),
        to_asset:assets!transactions_to_asset_id_fkey(*)
      `)
      .eq('transaction_date', date)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });
    if (error) {
      if (isMissingTableError(error)) return [];
      throw toUserFacingSupabaseError(error, '거래');
    }
    return data ?? [];
  },

  create: async (transaction: CreateTransactionDto): Promise<Transaction> => {
    const { data, error } = await db
      .from('transactions')
      .insert(transaction)
      .select()
      .single();
    if (error) throw toUserFacingSupabaseError(error, '거래');
    return data;
  },

  update: async (id: string, updates: UpdateTransactionDto): Promise<Transaction> => {
    const { data, error } = await db
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw toUserFacingSupabaseError(error, '거래');
    return data;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await db
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw toUserFacingSupabaseError(error, '거래');
  },

  moveToDate: async (id: string, newDate: string): Promise<Transaction> => {
    return financeService.update(id, { transaction_date: newDate });
  },

  getMonthlySummary: async (userId: string, year: number, month: number): Promise<MonthlySummary> => {
    const { data, error } = await db.rpc('get_monthly_summary', {
      p_user_id: userId,
      p_year: year,
      p_month: month,
    });
    if (error) {
      if (isMissingFunctionError(error) || isMissingTableError(error)) {
        return { total_income: 0, total_expense: 0, net_balance: 0 };
      }
      throw toUserFacingSupabaseError(error, '월별 요약');
    }
    return data?.[0] ?? { total_income: 0, total_expense: 0, net_balance: 0 };
  },

  getCategorySpending: async (userId: string, year: number, month: number): Promise<CategorySpending[]> => {
    const { data, error } = await db.rpc('get_category_spending', {
      p_user_id: userId,
      p_year: year,
      p_month: month,
    });
    if (error) {
      if (isMissingFunctionError(error) || isMissingTableError(error)) return [];
      throw toUserFacingSupabaseError(error, '카테고리 지출');
    }
    return data ?? [];
  },

  batchUpdateSortOrder: async (updates: { id: string; sort_order: number }[]): Promise<void> => {
    const promises = updates.map(({ id, sort_order }) =>
      db.from('transactions').update({ sort_order }).eq('id', id)
    );
    const results = await Promise.all(promises);
    const errors = results.filter((r: any) => r.error).map((r: any) => r.error);
    if (errors.length > 0) throw toUserFacingSupabaseError(errors[0], '거래');
  },
};
