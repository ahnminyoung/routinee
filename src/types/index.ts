// 타입 정의: src/types/index.ts
import {
  CategoryRow, CategoryInsert, CategoryUpdate,
  TodoRow, TodoInsert, TodoUpdate,
  AssetRow, AssetInsert, AssetUpdate,
  TransactionRow, TransactionInsert, TransactionUpdate,
  BudgetRow, BudgetInsert, BudgetUpdate,
  UserProfileRow, UserProfileUpdate,
  ConnectionRow, ConnectionInsert, ConnectionUpdate,
  TodoParticipantRow, TodoParticipantInsert, TodoParticipantUpdate,
  UserSubscriptionRow, UserSubscriptionInsert, UserSubscriptionUpdate,
} from './database.types';

// DB Row 타입 별칭
export type Category    = CategoryRow;
export type Todo        = TodoRow;
export type Asset       = AssetRow;
export type Transaction = TransactionRow;
export type Budget      = BudgetRow;
export type UserProfile = UserProfileRow;
export type Connection = ConnectionRow;
export type TodoParticipant = TodoParticipantRow;
export type UserSubscription = UserSubscriptionRow;

// Insert/Update DTO 타입
export type CreateTodoDto        = TodoInsert;
export type UpdateTodoDto        = TodoUpdate;
export type CreateTransactionDto = TransactionInsert;
export type UpdateTransactionDto = TransactionUpdate;
export type CreateAssetDto       = AssetInsert;
export type UpdateAssetDto       = AssetUpdate;
export type CreateBudgetDto      = BudgetInsert;
export type CreateCategoryDto    = CategoryInsert;
export type CreateConnectionDto  = ConnectionInsert;
export type UpdateConnectionDto  = ConnectionUpdate;
export type CreateTodoParticipantDto = TodoParticipantInsert;
export type UpdateTodoParticipantDto = TodoParticipantUpdate;
export type CreateUserSubscriptionDto = UserSubscriptionInsert;
export type UpdateUserSubscriptionDto = UserSubscriptionUpdate;

// 공통 유틸리티 타입
export type TodoPriority    = Todo['priority'];
export type TodoStatus      = Todo['status'];
export type AssetType       = Asset['type'];
export type TransactionType = Transaction['type'];
export type BudgetPeriod    = Budget['period'];
export type CategoryType    = Category['type'];
export type AppTheme        = UserProfile['theme'];

// 집계 타입
export interface MonthlySummary {
  total_income:  number;
  total_expense: number;
  net_balance:   number;
}

export interface CategorySpending {
  category_id:    string;
  category_name:  string;
  category_color: string;
  total_amount:   number;
}

// 캘린더 이벤트 (할일 + 거래 통합)
export interface CalendarEvent {
  date: string; // YYYY-MM-DD
  todos: Todo[];
  transactions: Transaction[];
  totalIncome:  number;
  totalExpense: number;
}

// 예산 사용 현황
export interface BudgetUsage {
  budget: Budget;
  category: Category | null;
  spent: number;
  percentage: number;
  isOverBudget: boolean;
}

export type { Database } from './database.types';
