import { supabase } from './supabase';
import { Asset, CreateAssetDto, UpdateAssetDto } from '../types';
import { isMissingTableError, toUserFacingSupabaseError } from './supabase-error';

const db = supabase as any;

export const assetService = {
  fetchAll: async (userId: string): Promise<Asset[]> => {
    const { data, error } = await db
      .from('assets')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) {
      if (isMissingTableError(error)) return [];
      throw toUserFacingSupabaseError(error, '자산');
    }
    return data ?? [];
  },

  create: async (asset: CreateAssetDto): Promise<Asset> => {
    const { data, error } = await db
      .from('assets')
      .insert(asset)
      .select()
      .single();
    if (error) throw toUserFacingSupabaseError(error, '자산');
    return data;
  },

  update: async (id: string, updates: UpdateAssetDto): Promise<Asset> => {
    const { data, error } = await db
      .from('assets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw toUserFacingSupabaseError(error, '자산');
    return data;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await db
      .from('assets')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id);
    if (error) throw toUserFacingSupabaseError(error, '자산');
  },

  getTotalBalance: (assets: Asset[]): number => {
    return assets.reduce((sum, asset) => {
      if (asset.type === 'loan') return sum - asset.current_balance;
      return sum + asset.current_balance;
    }, 0);
  },
};
