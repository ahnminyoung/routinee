import { create } from 'zustand';
import { AppTheme } from '../types';

interface UIStore {
  theme: AppTheme;
  isAddModalOpen: boolean;
  addModalType: 'todo' | 'transaction' | null;
  inAppNotice: {
    id: string;
    title: string;
    message: string;
  } | null;

  setTheme: (theme: AppTheme) => void;
  openAddModal: (type: 'todo' | 'transaction') => void;
  closeAddModal: () => void;
  showInAppNotice: (title: string, message: string, durationMs?: number) => void;
  clearInAppNotice: () => void;
}

let noticeTimer: ReturnType<typeof setTimeout> | null = null;

export const useUIStore = create<UIStore>((set) => ({
  theme: 'system',
  isAddModalOpen: false,
  addModalType: null,
  inAppNotice: null,

  setTheme: (theme) => set({ theme }),
  openAddModal: (type) => set({ isAddModalOpen: true, addModalType: type }),
  closeAddModal: () => set({ isAddModalOpen: false, addModalType: null }),

  showInAppNotice: (title, message, durationMs = 4500) => {
    if (noticeTimer) {
      clearTimeout(noticeTimer);
      noticeTimer = null;
    }

    set({
      inAppNotice: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        message,
      },
    });

    noticeTimer = setTimeout(() => {
      set({ inAppNotice: null });
      noticeTimer = null;
    }, durationMs);
  },

  clearInAppNotice: () => {
    if (noticeTimer) {
      clearTimeout(noticeTimer);
      noticeTimer = null;
    }
    set({ inAppNotice: null });
  },
}));
