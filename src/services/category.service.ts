import { supabase } from './supabase';
import { Category, CreateCategoryDto, CategoryType } from '../types';
import { isMissingTableError, toUserFacingSupabaseError } from './supabase-error';

const db = supabase as any;

export const categoryService = {
  fetchAll: async (userId: string): Promise<Category[]> => {
    const { data, error } = await db
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });
    if (error) {
      if (isMissingTableError(error)) return [];
      throw toUserFacingSupabaseError(error, '카테고리');
    }
    return data ?? [];
  },

  fetchByType: async (userId: string, type: CategoryType): Promise<Category[]> => {
    const { data, error } = await db
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .or(`type.eq.${type},type.eq.both`)
      .order('sort_order', { ascending: true });
    if (error) {
      if (isMissingTableError(error)) return [];
      throw toUserFacingSupabaseError(error, '카테고리');
    }
    return data ?? [];
  },

  create: async (category: CreateCategoryDto): Promise<Category> => {
    const { data, error } = await db
      .from('categories')
      .insert(category)
      .select()
      .single();
    if (error) throw toUserFacingSupabaseError(error, '카테고리');
    return data;
  },

  update: async (id: string, updates: Partial<CreateCategoryDto>): Promise<Category> => {
    const { data, error } = await db
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw toUserFacingSupabaseError(error, '카테고리');
    return data;
  },

  delete: async (id: string, isDefault: boolean): Promise<void> => {
    if (isDefault) throw new Error('기본 카테고리는 삭제할 수 없습니다.');
    const { error } = await db
      .from('categories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw toUserFacingSupabaseError(error, '카테고리');
  },
};
