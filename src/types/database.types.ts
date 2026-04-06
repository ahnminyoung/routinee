export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Category Row
export interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  type: 'todo' | 'income' | 'expense' | 'both';
  color: string;
  icon: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export type CategoryInsert = {
  user_id: string;
  name: string;
  type: 'todo' | 'income' | 'expense' | 'both';
  id?: string;
  color?: string;
  icon?: string;
  is_default?: boolean;
  sort_order?: number;
  deleted_at?: string | null;
};
export type CategoryUpdate = Partial<CategoryInsert>;

// Todo Row
export interface TodoRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date: string | null;
  due_time: string | null;
  completed_at: string | null;
  sort_order: number;
  is_recurring: boolean;
  recurrence_rule: string | null;
  recurrence_parent_id: string | null;
  linked_transaction_id: string | null;
  is_all_day: boolean;
  start_at: string | null;
  end_at: string | null;
  is_lunar: boolean;
  save_as_memo: boolean;
  is_anniversary: boolean;
  label_color: string;
  reminder_minutes: number;
  d_day_enabled: boolean;
  location: string | null;
  link_url: string | null;
  memo: string | null;
  checklist_json: Json;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export type TodoInsert = {
  user_id: string;
  title: string;
  id?: string;
  description?: string | null;
  category_id?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date?: string | null;
  due_time?: string | null;
  completed_at?: string | null;
  sort_order?: number;
  is_recurring?: boolean;
  recurrence_rule?: string | null;
  recurrence_parent_id?: string | null;
  linked_transaction_id?: string | null;
  is_all_day?: boolean;
  start_at?: string | null;
  end_at?: string | null;
  is_lunar?: boolean;
  save_as_memo?: boolean;
  is_anniversary?: boolean;
  label_color?: string;
  reminder_minutes?: number;
  d_day_enabled?: boolean;
  location?: string | null;
  link_url?: string | null;
  memo?: string | null;
  checklist_json?: Json;
  attachment_url?: string | null;
  deleted_at?: string | null;
};
export type TodoUpdate = Partial<TodoInsert>;

// Asset Row
export interface AssetRow {
  id: string;
  user_id: string;
  name: string;
  type: 'bank_account' | 'credit_card' | 'cash' | 'investment' | 'loan';
  institution: string | null;
  color: string;
  icon: string;
  initial_balance: number;
  current_balance: number;
  credit_limit: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export type AssetInsert = {
  user_id: string;
  name: string;
  type: 'bank_account' | 'credit_card' | 'cash' | 'investment' | 'loan';
  id?: string;
  institution?: string | null;
  color?: string;
  icon?: string;
  initial_balance?: number;
  current_balance?: number;
  credit_limit?: number | null;
  sort_order?: number;
  is_active?: boolean;
  deleted_at?: string | null;
};
export type AssetUpdate = Partial<AssetInsert>;

// Transaction Row
export interface TransactionRow {
  id: string;
  user_id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  description: string;
  memo: string | null;
  category_id: string | null;
  asset_id: string | null;
  to_asset_id: string | null;
  transaction_date: string;
  transaction_time: string | null;
  receipt_url: string | null;
  receipt_ocr_data: Json | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  recurrence_parent_id: string | null;
  linked_todo_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export type TransactionInsert = {
  user_id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  description: string;
  transaction_date: string;
  id?: string;
  memo?: string | null;
  category_id?: string | null;
  asset_id?: string | null;
  to_asset_id?: string | null;
  transaction_time?: string | null;
  receipt_url?: string | null;
  receipt_ocr_data?: Json | null;
  is_recurring?: boolean;
  recurrence_rule?: string | null;
  recurrence_parent_id?: string | null;
  linked_todo_id?: string | null;
  sort_order?: number;
  deleted_at?: string | null;
};
export type TransactionUpdate = Partial<TransactionInsert>;

// Budget Row
export interface BudgetRow {
  id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  month: number | null;
  year: number | null;
  alert_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export type BudgetInsert = {
  user_id: string;
  amount: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  id?: string;
  category_id?: string | null;
  month?: number | null;
  year?: number | null;
  alert_threshold?: number;
  is_active?: boolean;
};
export type BudgetUpdate = Partial<BudgetInsert>;

// UserProfile Row
export interface UserProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  currency: string;
  locale: string;
  theme: 'light' | 'dark' | 'system';
  week_start_day: number;
  push_token: string | null;
  biometric_enabled: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}
export type UserProfileUpdate = Partial<Omit<UserProfileRow, 'id' | 'created_at'>>;

// Connection Row
export interface ConnectionRow {
  id: string;
  user_a_id: string;
  user_b_id: string;
  created_by: string;
  share_finance: boolean;
  created_at: string;
}
export type ConnectionInsert = {
  user_a_id: string;
  user_b_id: string;
  created_by: string;
  share_finance?: boolean;
  id?: string;
};
export type ConnectionUpdate = Partial<ConnectionInsert>;

// TodoParticipant Row
export interface TodoParticipantRow {
  id: string;
  todo_id: string;
  user_id: string;
  added_by: string;
  created_at: string;
}
export type TodoParticipantInsert = {
  todo_id: string;
  user_id: string;
  added_by: string;
  id?: string;
};
export type TodoParticipantUpdate = Partial<TodoParticipantInsert>;

// UserSubscription Row
export interface UserSubscriptionRow {
  id: string;
  user_id: string;
  plan: 'free' | 'pro';
  status: 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing';
  provider: 'manual' | 'stripe' | 'app_store' | 'play_store' | 'revenuecat';
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
}
export type UserSubscriptionInsert = {
  user_id: string;
  id?: string;
  plan?: 'free' | 'pro';
  status?: 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing';
  provider?: 'manual' | 'stripe' | 'app_store' | 'play_store' | 'revenuecat';
  provider_customer_id?: string | null;
  provider_subscription_id?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  metadata?: Json;
};
export type UserSubscriptionUpdate = Partial<UserSubscriptionInsert>;

// Supabase Database type
export interface Database {
  public: {
    Tables: {
      categories: {
        Row: CategoryRow;
        Insert: CategoryInsert;
        Update: CategoryUpdate;
        Relationships: [];
      };
      todos: {
        Row: TodoRow;
        Insert: TodoInsert;
        Update: TodoUpdate;
        Relationships: [];
      };
      assets: {
        Row: AssetRow;
        Insert: AssetInsert;
        Update: AssetUpdate;
        Relationships: [];
      };
      transactions: {
        Row: TransactionRow;
        Insert: TransactionInsert;
        Update: TransactionUpdate;
        Relationships: [];
      };
      budgets: {
        Row: BudgetRow;
        Insert: BudgetInsert;
        Update: BudgetUpdate;
        Relationships: [];
      };
      user_profiles: {
        Row: UserProfileRow;
        Insert: { id: string } & Partial<Omit<UserProfileRow, 'id' | 'created_at' | 'updated_at'>>;
        Update: UserProfileUpdate;
        Relationships: [];
      };
      connections: {
        Row: ConnectionRow;
        Insert: ConnectionInsert;
        Update: ConnectionUpdate;
        Relationships: [];
      };
      todo_participants: {
        Row: TodoParticipantRow;
        Insert: TodoParticipantInsert;
        Update: TodoParticipantUpdate;
        Relationships: [];
      };
      user_subscriptions: {
        Row: UserSubscriptionRow;
        Insert: UserSubscriptionInsert;
        Update: UserSubscriptionUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_monthly_summary: {
        Args: { p_user_id: string; p_year: number; p_month: number };
        Returns: { total_income: number; total_expense: number; net_balance: number }[];
      };
      get_category_spending: {
        Args: { p_user_id: string; p_year: number; p_month: number };
        Returns: { category_id: string; category_name: string; category_color: string; total_amount: number }[];
      };
      seed_default_categories: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
