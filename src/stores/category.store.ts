import { create } from 'zustand';
import { Category, CategoryType, CreateCategoryDto } from '../types';
import { categoryService } from '../services/category.service';

interface CategoryStore {
  categories: Category[];
  isLoading: boolean;

  // Selectors
  getCategoriesByType: (type: CategoryType) => Category[];
  getCategoryById: (id: string) => Category | undefined;

  // Actions
  fetchCategories: (userId: string) => Promise<void>;
  addCategory: (category: CreateCategoryDto) => Promise<Category>;
  updateCategory: (id: string, updates: Partial<CreateCategoryDto>) => Promise<void>;
  deleteCategory: (id: string, isDefault: boolean) => Promise<void>;
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  categories: [],
  isLoading: false,

  getCategoriesByType: (type) => {
    return get().categories.filter(
      (c) => c.type === type || c.type === 'both'
    );
  },

  getCategoryById: (id) => get().categories.find((c) => c.id === id),

  fetchCategories: async (userId) => {
    set({ isLoading: true });
    try {
      const categories = await categoryService.fetchAll(userId);
      set({ categories });
    } catch (error) {
      console.warn('[CategoryStore] 카테고리 조회에 실패했습니다.', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addCategory: async (dto) => {
    const category = await categoryService.create(dto);
    set((state) => ({ categories: [...state.categories, category] }));
    return category;
  },

  updateCategory: async (id, updates) => {
    const updated = await categoryService.update(id, updates);
    set((state) => ({
      categories: state.categories.map((c) => (c.id === id ? updated : c)),
    }));
  },

  deleteCategory: async (id, isDefault) => {
    await categoryService.delete(id, isDefault);
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
    }));
  },
}));
