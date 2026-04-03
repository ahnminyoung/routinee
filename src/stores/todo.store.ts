import { create } from 'zustand';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Todo, CreateTodoDto, UpdateTodoDto } from '../types';
import { todoService } from '../services/todo.service';
import { today } from '../utils/date';
import { APP_CONSTANTS } from '../utils/constants';

interface TodoStore {
  todosByDate: Record<string, Todo[]>;    // key: YYYY-MM-DD
  selectedDate: string;
  isLoading: boolean;
  lastFetched: Record<string, number>;   // timestamp per date

  // Selectors
  getTodosForDate: (date: string) => Todo[];
  getTodayTodos: () => Todo[];

  // Actions
  setSelectedDate: (date: string) => void;
  fetchTodosForDate: (userId: string, date: string, force?: boolean) => Promise<void>;
  fetchTodosForRange: (userId: string, startDate: string, endDate: string, force?: boolean) => Promise<void>;
  addTodo: (todo: CreateTodoDto) => Promise<Todo>;
  updateTodo: (id: string, updates: UpdateTodoDto) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  reorderTodos: (newOrder: Todo[], date: string) => Promise<void>;
  moveToDate: (id: string, fromDate: string, toDate: string) => Promise<void>;
  handleRealtimeEvent: (payload: RealtimePostgresChangesPayload<Todo>) => void;
}

export const useTodoStore = create<TodoStore>((set, get) => ({
  todosByDate: {},
  selectedDate: today(),
  isLoading: false,
  lastFetched: {},

  getTodosForDate: (date) => get().todosByDate[date] ?? [],

  getTodayTodos: () => get().todosByDate[today()] ?? [],

  setSelectedDate: (date) => set({ selectedDate: date }),

  fetchTodosForDate: async (userId, date, force = false) => {
    const { lastFetched } = get();
    const now = Date.now();
    // 5분 이내 캐시 히트 시 스킵
    if (!force && lastFetched[date] && now - lastFetched[date] < APP_CONSTANTS.REALTIME_STALE_TIME_MS) {
      return;
    }

    set({ isLoading: true });
    try {
      const todos = await todoService.fetchByDate(userId, date);
      set((state) => ({
        todosByDate: { ...state.todosByDate, [date]: todos },
        lastFetched: { ...state.lastFetched, [date]: now },
      }));
    } catch (error) {
      console.warn('[TodoStore] 할일 조회에 실패했습니다.', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchTodosForRange: async (userId, startDate, endDate, force = false) => {
    const { lastFetched } = get();
    const now = Date.now();

    const rangeDates: string[] = [];
    let cursor = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    while (cursor <= end) {
      rangeDates.push(cursor.toISOString().split('T')[0]);
      cursor.setDate(cursor.getDate() + 1);
    }

    const isRangeCached =
      !force &&
      rangeDates.length > 0 &&
      rangeDates.every((date) => (
        !!lastFetched[date] && now - lastFetched[date] < APP_CONSTANTS.REALTIME_STALE_TIME_MS
      ));

    if (isRangeCached) return;

    set({ isLoading: true });
    try {
      const todos = await todoService.fetchByDateRange(userId, startDate, endDate);
      const grouped: Record<string, Todo[]> = Object.fromEntries(
        rangeDates.map((date) => [date, [] as Todo[]])
      );
      for (const todo of todos) {
        const dateKey = todo.due_date ?? today();
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(todo);
      }
      const nextLastFetched = Object.fromEntries(rangeDates.map((date) => [date, now]));
      set((state) => ({
        todosByDate: { ...state.todosByDate, ...grouped },
        lastFetched: { ...state.lastFetched, ...nextLastFetched },
      }));
    } catch (error) {
      console.warn('[TodoStore] 기간 할일 조회에 실패했습니다.', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addTodo: async (todoDto) => {
    const todo = await todoService.create(todoDto);
    const date = todo.due_date ?? today();
    set((state) => ({
      todosByDate: {
        ...state.todosByDate,
        [date]: [...(state.todosByDate[date] ?? []), todo],
      },
    }));
    return todo;
  },

  updateTodo: async (id, updates) => {
    const updated = await todoService.update(id, updates);
    set((state) => {
      const newByDate = { ...state.todosByDate };
      // 모든 날짜에서 해당 ID 업데이트
      for (const date in newByDate) {
        newByDate[date] = newByDate[date].map((t) => (t.id === id ? updated : t));
      }
      return { todosByDate: newByDate };
    });
  },

  deleteTodo: async (id) => {
    await todoService.delete(id);
    set((state) => {
      const newByDate = { ...state.todosByDate };
      for (const date in newByDate) {
        newByDate[date] = newByDate[date].filter((t) => t.id !== id);
      }
      return { todosByDate: newByDate };
    });
  },

  toggleComplete: async (id) => {
    const allTodos = Object.values(get().todosByDate).flat();
    const todo = allTodos.find((t) => t.id === id);
    if (!todo) return;
    const isCompleted = todo.status !== 'completed';
    try {
      await todoService.toggleComplete(id, isCompleted);
      const updated: Todo = {
        ...todo,
        status: isCompleted ? 'completed' : 'pending',
        completed_at: isCompleted ? new Date().toISOString() : null,
      };
      set((state) => {
        const newByDate = { ...state.todosByDate };
        for (const date in newByDate) {
          newByDate[date] = newByDate[date].map((t) => (t.id === id ? updated : t));
        }
        return { todosByDate: newByDate };
      });
    } catch (error) {
      console.warn('[TodoStore] 할일 상태 변경에 실패했습니다.', error);
    }
  },

  reorderTodos: async (newOrder, date) => {
    const previous = get().todosByDate[date];
    // 낙관적 업데이트
    set((state) => ({
      todosByDate: { ...state.todosByDate, [date]: newOrder },
    }));
    try {
      await todoService.batchUpdateSortOrder(
        newOrder.map((t, i) => ({ id: t.id, sort_order: i }))
      );
    } catch {
      // 롤백
      set((state) => ({
        todosByDate: { ...state.todosByDate, [date]: previous },
      }));
    }
  },

  moveToDate: async (id, fromDate, toDate) => {
    const todo = get().todosByDate[fromDate]?.find((t) => t.id === id);
    if (!todo) return;

    // 낙관적 업데이트
    const updatedTodo = { ...todo, due_date: toDate };
    set((state) => ({
      todosByDate: {
        ...state.todosByDate,
        [fromDate]: (state.todosByDate[fromDate] ?? []).filter((t) => t.id !== id),
        [toDate]: [...(state.todosByDate[toDate] ?? []), updatedTodo],
      },
    }));

    try {
      await todoService.moveToDate(id, toDate);
    } catch {
      // 롤백
      set((state) => ({
        todosByDate: {
          ...state.todosByDate,
          [fromDate]: [...(state.todosByDate[fromDate] ?? []), todo],
          [toDate]: (state.todosByDate[toDate] ?? []).filter((t) => t.id !== id),
        },
      }));
    }
  },

  handleRealtimeEvent: (payload) => {
    set((state) => {
      const newByDate = { ...state.todosByDate };

      if (payload.eventType === 'INSERT') {
        const todo = payload.new as Todo;
        const date = todo.due_date ?? today();
        if (newByDate[date]) {
          newByDate[date] = [...newByDate[date], todo];
        }
      }

      if (payload.eventType === 'UPDATE') {
        const todo = payload.new as Todo;
        for (const date in newByDate) {
          newByDate[date] = newByDate[date].map((t) => (t.id === todo.id ? todo : t));
        }
      }

      if (payload.eventType === 'DELETE') {
        const id = payload.old.id;
        for (const date in newByDate) {
          newByDate[date] = newByDate[date].filter((t) => t.id !== id);
        }
      }

      return { todosByDate: newByDate };
    });
  },
}));
