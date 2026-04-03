import { create } from 'zustand';
import { Asset, CreateAssetDto, UpdateAssetDto } from '../types';
import { assetService } from '../services/asset.service';

interface AssetStore {
  assets: Asset[];
  isLoading: boolean;
  totalBalance: number;

  fetchAssets: (userId: string) => Promise<void>;
  addAsset: (asset: CreateAssetDto) => Promise<Asset>;
  updateAsset: (id: string, updates: UpdateAssetDto) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  refreshBalances: (userId: string) => Promise<void>;
}

export const useAssetStore = create<AssetStore>((set, get) => ({
  assets: [],
  isLoading: false,
  totalBalance: 0,

  fetchAssets: async (userId) => {
    set({ isLoading: true });
    try {
      const assets = await assetService.fetchAll(userId);
      set({ assets, totalBalance: assetService.getTotalBalance(assets) });
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
      return { assets, totalBalance: assetService.getTotalBalance(assets) };
    });
    return asset;
  },

  updateAsset: async (id, updates) => {
    const updated = await assetService.update(id, updates);
    set((state) => {
      const assets = state.assets.map((a) => (a.id === id ? updated : a));
      return { assets, totalBalance: assetService.getTotalBalance(assets) };
    });
  },

  deleteAsset: async (id) => {
    await assetService.delete(id);
    set((state) => {
      const assets = state.assets.filter((a) => a.id !== id);
      return { assets, totalBalance: assetService.getTotalBalance(assets) };
    });
  },

  refreshBalances: async (userId) => {
    try {
      const assets = await assetService.fetchAll(userId);
      set({ assets, totalBalance: assetService.getTotalBalance(assets) });
    } catch (error) {
      console.warn('[AssetStore] 자산 잔액 갱신에 실패했습니다.', error);
    }
  },
}));
