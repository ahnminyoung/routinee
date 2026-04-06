// 전역 상태 관리 로직: src/stores/todo.store.ts
import { create } from 'zustand';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Todo, CreateTodoDto, UpdateTodoDto } from '../types';
import { todoService } from '../services/todo.service';
import { today } from '../utils/date';
import { APP_CONSTANTS } from '../utils/constants';
import { offlineQueueService } from '../services/offline-queue.service';
import { offlineSyncManager } from '../services/offline-sync-manager.service';
import { opsLogService } from '../services/ops-log.service';

// 네트워크 단절 계열 에러를 식별해 오프라인 큐 분기로 전환합니다.
function isLikelyNetworkError(error: unknown) {
  const message = String((error as any)?.message ?? error ?? '').toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('timeout')
  );
}

// 서버 확정 전 로컬 임시 레코드 구분자
function isLocalId(id: string) {
  return id.startsWith('local-');
}

// 오프라인 생성 즉시 화면에 표시할 임시 Todo 레코드를 구성합니다.
function createLocalTodo(dto: CreateTodoDto): Todo {
  const now = new Date().toISOString();
  return {
    id: `local-todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    user_id: dto.user_id,
    title: dto.title,
    description: dto.description ?? null,
    category_id: dto.category_id ?? null,
    priority: dto.priority ?? 'medium',
    status: dto.status ?? 'pending',
    due_date: dto.due_date ?? today(),
    due_time: dto.due_time ?? null,
    completed_at: dto.completed_at ?? null,
    sort_order: dto.sort_order ?? 0,
    is_recurring: dto.is_recurring ?? false,
    recurrence_rule: dto.recurrence_rule ?? null,
    recurrence_parent_id: dto.recurrence_parent_id ?? null,
    linked_transaction_id: dto.linked_transaction_id ?? null,
    is_all_day: dto.is_all_day ?? true,
    start_at: dto.start_at ?? null,
    end_at: dto.end_at ?? null,
    is_lunar: dto.is_lunar ?? false,
    save_as_memo: dto.save_as_memo ?? false,
    is_anniversary: dto.is_anniversary ?? false,
    label_color: dto.label_color ?? '#10B981',
    reminder_minutes: dto.reminder_minutes ?? 10,
    d_day_enabled: dto.d_day_enabled ?? false,
    location: dto.location ?? null,
    link_url: dto.link_url ?? null,
    memo: dto.memo ?? null,
    checklist_json: dto.checklist_json ?? [],
    attachment_url: dto.attachment_url ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: dto.deleted_at ?? null,
  };
}

// 같은 날짜 버킷에서 기존 항목을 교체(없으면 추가)합니다.
function upsertTodoInDate(todos: Todo[], todo: Todo) {
  return [...todos.filter((item) => item.id !== todo.id), todo];
}

// due_date 변경을 포함한 update 시 날짜 버킷 간 이동을 일관되게 처리합니다.
function placeTodoAcrossDates(
  todosByDate: Record<string, Todo[]>,
  todoId: string,
  nextTodo: Todo
) {
  const next = { ...todosByDate };
  for (const date in next) {
    if (!next[date].some((todo) => todo.id === todoId)) continue;
    next[date] = next[date].filter((todo) => todo.id !== todoId);
  }
  const targetDate = nextTodo.due_date ?? today();
  next[targetDate] = upsertTodoInDate(next[targetDate] ?? [], nextTodo);
  return next;
}

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
    // 5분 이내 캐시 히트 시 재조회 생략(네트워크/배터리 절약)
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

    // 화면에 필요한 날짜 범위를 미리 펼쳐서 빈 날짜도 키를 유지합니다.
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
    try {
      // 온라인이면 서버 생성 결과를 그대로 반영합니다.
      const todo = await todoService.create(todoDto);
      const date = todo.due_date ?? today();
      set((state) => ({
        todosByDate: {
          ...state.todosByDate,
          [date]: [...(state.todosByDate[date] ?? []), todo],
        },
      }));
      return todo;
    } catch (error) {
      if (!isLikelyNetworkError(error)) throw error;

      // 오프라인 생성: 로컬 임시 항목을 먼저 보여주고, 실제 생성은 큐에 적재합니다.
      const localTodo = createLocalTodo(todoDto);
      const date = localTodo.due_date ?? today();
      set((state) => ({
        todosByDate: {
          ...state.todosByDate,
          [date]: [...(state.todosByDate[date] ?? []), localTodo],
        },
      }));

      await offlineQueueService.enqueue({
        user_id: todoDto.user_id,
        entity: 'todo',
        action: 'create',
        payload: todoDto as any,
        meta: {
          local_id: localTodo.id,
          date,
          note: 'offline-create-todo',
        },
      });
      await opsLogService.log('todo.offline.enqueued.create', {
        local_id: localTodo.id,
        date,
      }, 'warn');
      void offlineSyncManager.flush();
      return localTodo;
    }
  },

  updateTodo: async (id, updates) => {
    // 현재 화면 캐시에서 대상 Todo를 찾아 낙관적 업데이트 기준으로 사용합니다.
    const allTodos = Object.values(get().todosByDate).flat();
    const current = allTodos.find((t) => t.id === id);
    if (!current) return;

    const optimistic: Todo = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (isLocalId(id)) {
      // local 생성건은 서버 호출 대신 "create payload 수정"으로 통합합니다.
      set((state) => {
        return { todosByDate: placeTodoAcrossDates(state.todosByDate, id, optimistic) };
      });
      await offlineQueueService.updateCreatePayload(current.user_id, 'todo', id, updates as any);
      return;
    }

    try {
      // 온라인 수정 성공 시 서버 최신값 기준으로 버킷 재배치
      const updated = await todoService.update(id, updates);
      set((state) => {
        return { todosByDate: placeTodoAcrossDates(state.todosByDate, id, updated) };
      });
    } catch (error) {
      if (!isLikelyNetworkError(error)) throw error;

      // 오프라인 수정: UI는 즉시 반영하고, 서버 반영은 큐로 지연합니다.
      set((state) => {
        return { todosByDate: placeTodoAcrossDates(state.todosByDate, id, optimistic) };
      });

      const dateHint = updates.due_date ?? current.due_date ?? today();
      await offlineQueueService.enqueue({
        user_id: current.user_id,
        entity: 'todo',
        action: 'update',
        target_id: id,
        payload: updates as any,
        meta: {
          date: dateHint,
          note: 'offline-update-todo',
        },
      });
      await opsLogService.log('todo.offline.enqueued.update', {
        id,
        date: dateHint,
      }, 'warn');
      void offlineSyncManager.flush();
    }
  },

  deleteTodo: async (id) => {
    const allTodos = Object.values(get().todosByDate).flat();
    const current = allTodos.find((t) => t.id === id);
    if (!current) return;

    // 화면 캐시에서 항목을 제거하는 공통 함수(온라인/오프라인 공용)
    const removeLocal = () => {
      set((state) => {
        const next = { ...state.todosByDate };
        for (const date in next) {
          next[date] = next[date].filter((t) => t.id !== id);
        }
        return { todosByDate: next };
      });
    };

    if (isLocalId(id)) {
      // 서버에 없는 local 항목은 큐 정리만으로 삭제 완료
      removeLocal();
      await offlineQueueService.removeLocalEntityOps(current.user_id, 'todo', id);
      return;
    }

    try {
      await todoService.delete(id);
      removeLocal();
    } catch (error) {
      if (!isLikelyNetworkError(error)) throw error;

      // 오프라인 삭제: 화면에서는 먼저 제거하고, 삭제 요청을 큐에 저장합니다.
      removeLocal();
      await offlineQueueService.enqueue({
        user_id: current.user_id,
        entity: 'todo',
        action: 'delete',
        target_id: id,
        payload: { id } as any,
        meta: {
          date: current.due_date ?? today(),
          note: 'offline-delete-todo',
        },
      });
      await opsLogService.log('todo.offline.enqueued.delete', { id }, 'warn');
      void offlineSyncManager.flush();
    }
  },

  toggleComplete: async (id) => {
    const allTodos = Object.values(get().todosByDate).flat();
    const todo = allTodos.find((t) => t.id === id);
    if (!todo) return;
    const isCompleted = todo.status !== 'completed';
    try {
      await get().updateTodo(id, {
        status: isCompleted ? 'completed' : 'pending',
        completed_at: isCompleted ? new Date().toISOString() : null,
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
    // fromDate는 호출부 호환을 위해 유지하고, 실제 이동은 updateTodo가 처리합니다.
    const todo = get().todosByDate[fromDate]?.find((t) => t.id === id);
    if (!todo) return;
    try {
      await get().updateTodo(id, { due_date: toDate });
    } catch {
      console.warn('[TodoStore] 할일 날짜 이동에 실패했습니다.');
    }
  },

  handleRealtimeEvent: (payload) => {
    // 다른 디바이스/세션에서 발생한 변경을 현재 캐시에 병합합니다.
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
        return { todosByDate: placeTodoAcrossDates(newByDate, todo.id, todo) };
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
