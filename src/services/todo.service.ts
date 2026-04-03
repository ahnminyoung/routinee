import { supabase } from './supabase';
import { CreateTodoDto, UpdateTodoDto, Todo } from '../types';
import { isMissingTableError, toUserFacingSupabaseError } from './supabase-error';

// Supabase 쿼리 빌더 타입 호환성을 위한 헬퍼
const db = supabase as any;

export const todoService = {
  /**
   * 특정 날짜의 할일 목록 조회
   */
  fetchByDate: async (_userId: string, date: string): Promise<Todo[]> => {
    const { data, error } = await db
      .from('todos')
      .select('*, categories(*)')
      .eq('due_date', date)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });
    if (error) {
      if (isMissingTableError(error)) return [];
      throw toUserFacingSupabaseError(error, '할일');
    }
    return data ?? [];
  },

  /**
   * 날짜 범위로 할일 목록 조회
   */
  fetchByDateRange: async (_userId: string, startDate: string, endDate: string): Promise<Todo[]> => {
    const { data, error } = await db
      .from('todos')
      .select('*')
      .gte('due_date', startDate)
      .lte('due_date', endDate)
      .is('deleted_at', null)
      .order('due_date', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error) {
      if (isMissingTableError(error)) return [];
      throw toUserFacingSupabaseError(error, '할일');
    }
    return data ?? [];
  },

  /**
   * 할일 생성
   */
  create: async (todo: CreateTodoDto): Promise<Todo> => {
    const { data, error } = await db
      .from('todos')
      .insert(todo)
      .select()
      .single();
    if (error) throw toUserFacingSupabaseError(error, '할일');
    return data;
  },

  /**
   * 할일 수정
   */
  update: async (id: string, updates: UpdateTodoDto): Promise<Todo> => {
    const { data, error } = await db
      .from('todos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw toUserFacingSupabaseError(error, '할일');
    return data;
  },

  /**
   * 할일 완료 처리
   */
  toggleComplete: async (id: string, isCompleted: boolean): Promise<Todo> => {
    const updates: UpdateTodoDto = isCompleted
      ? { status: 'completed', completed_at: new Date().toISOString() }
      : { status: 'pending', completed_at: null };
    return todoService.update(id, updates);
  },

  /**
   * 할일 소프트 삭제
   */
  delete: async (id: string): Promise<void> => {
    const { error } = await db
      .from('todos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw toUserFacingSupabaseError(error, '할일');
  },

  /**
   * 여러 할일 sort_order 일괄 업데이트 (드래그 후)
   */
  batchUpdateSortOrder: async (updates: { id: string; sort_order: number }[]): Promise<void> => {
    const promises = updates.map(({ id, sort_order }) =>
      db.from('todos').update({ sort_order }).eq('id', id)
    );
    const results = await Promise.all(promises);
    const errors = results.filter((r: any) => r.error).map((r: any) => r.error);
    if (errors.length > 0) throw toUserFacingSupabaseError(errors[0], '할일');
  },

  /**
   * 할일 날짜 변경 (드래그로 날짜 이동)
   */
  moveToDate: async (id: string, newDate: string): Promise<Todo> => {
    return todoService.update(id, { due_date: newDate });
  },
};
