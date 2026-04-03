import { TodoPriority, AssetType, TransactionType, BudgetPeriod, CategoryType } from '../types';

export const PRIORITY_LABELS: Record<TodoPriority, string> = {
  low:    '낮음',
  medium: '보통',
  high:   '높음',
  urgent: '긴급',
};

export const PRIORITY_COLORS: Record<TodoPriority, string> = {
  low:    '#6B7280',
  medium: '#F59E0B',
  high:   '#EF4444',
  urgent: '#DC2626',
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  bank_account: '은행 계좌',
  credit_card:  '신용카드',
  cash:         '현금',
  investment:   '투자',
  loan:         '대출',
};

export const ASSET_TYPE_ICONS: Record<AssetType, string> = {
  bank_account: 'building-2',
  credit_card:  'credit-card',
  cash:         'banknote',
  investment:   'trending-up',
  loan:         'landmark',
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income:   '수입',
  expense:  '지출',
  transfer: '이체',
};

export const BUDGET_PERIOD_LABELS: Record<BudgetPeriod, string> = {
  daily:   '매일',
  weekly:  '매주',
  monthly: '매월',
  yearly:  '매년',
};

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  todo:    '할일',
  income:  '수입',
  expense: '지출',
  both:    '공통',
};

// 카테고리 색상 팔레트
export const CATEGORY_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#10B981',
  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
  '#6B7280', '#92400E', '#065F46', '#1E3A5F', '#4C1D95',
] as const;

// 앱 상수
export const APP_CONSTANTS = {
  MAX_CATEGORY_NAME_LENGTH: 20,
  MAX_TODO_TITLE_LENGTH: 100,
  MAX_TRANSACTION_DESCRIPTION_LENGTH: 100,
  MAX_MEMO_LENGTH: 500,
  REALTIME_STALE_TIME_MS: 5 * 60 * 1000,    // 5분
  OFFLINE_QUEUE_MAX_SIZE: 100,
  BUDGET_ALERT_THRESHOLD: 80,                // 80% 이상 시 알림
} as const;

// 달 이름
export const MONTH_NAMES = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
] as const;

// 요일 이름 (월요일 시작)
export const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'] as const;
