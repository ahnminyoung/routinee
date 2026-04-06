import { create } from 'zustand';
import { Asset, CreateAssetDto, UpdateAssetDto } from '../types';
import { assetService } from '../services/asset.service';

interface AssetStore {
  assets: Asset[];
  isLoading: boolean;
  totalBalance: number;  // 본인 + 공유 자산 합계
  ownBalance: number;    // 본인 자산만의 합계

  fetchAssets: (userId: string) => Promise<void>;
  addAsset: (asset: CreateAssetDto) => Promise<Asset>;
  updateAsset: (id: string, updates: UpdateAssetDto) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  refreshBalances: (userId: string) => Promise<void>;
}

export const useAssetStore = create<AssetStore>((set) => ({
  assets: [],
  isLoading: false,
  totalBalance: 0,
  ownBalance: 0,

  fetchAssets: async (userId) => {
    set({ isLoading: true });
    try {
      const assets = await assetService.fetchAll(userId);
      set({
        assets,
        totalBalance: assetService.getTotalBalance(assets),
        ownBalance: assetService.getTotalBalance(assets.filter((a) => a.user_id === userId)),
      });
    } catch (error) {
      console.warn('[AssetStore] 자산 조회에 실패했습니다.', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addAsset: async (dto) => {
    const asset = await assetService.create(dto);
    set((state) => {
      const assets = [...state.assets, asset];
      return {
        assets,
        totalBalance: assetService.getTotalBalance(assets),
        ownBalance: assetService.getTotalBalance(assets.filter((a) => a.user_id === dto.user_id)),
      };
    });
    return asset;
  },

  updateAsset: async (id, updates) => {
    const updated = await assetService.update(id, updates);
    set((state) => {
      const assets = state.assets.map((a) => (a.id === id ? updated : a));
      const ownAssets = assets.filter((a) => a.user_id === updated.user_id);
      return {
        assets,
        totalBalance: assetService.getTotalBalance(assets),
        ownBalance: assetService.getTotalBalance(ownAssets),
      };
    });
  },

  deleteAsset: async (id) => {
    await assetService.delete(id);
    set((state) => {
      const deletedAsset = state.assets.find((a) => a.id === id);
      const assets = state.assets.filter((a) => a.id !== id);
      if (!deletedAsset) {
        return {
          assets,
          totalBalance: assetService.getTotalBalance(assets),
          ownBalance: state.ownBalance,
        };
      }
      const ownAssets = assets.filter((a) => a.user_id === deletedAsset.user_id);
      return {
        assets,
        totalBalance: assetService.getTotalBalance(assets),
        ownBalance: assetService.getTotalBalance(ownAssets),
      };
    });
  },

  refreshBalances: async (userId) => {
    try {
      const assets = await assetService.fetchAll(userId);
      set({
        assets,
        totalBalance: assetService.getTotalBalance(assets),
        ownBalance: assetService.getTotalBalance(assets.filter((a) => a.user_id === userId)),
      });
    } catch (error) {
      console.warn('[AssetStore] 자산 잔액 갱신에 실패했습니다.', error);
    }
  },
}));
