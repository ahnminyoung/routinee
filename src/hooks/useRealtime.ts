// 커스텀 훅 로직: src/hooks/useRealtime.ts
import { useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useTodoStore } from '../stores/todo.store';
import { useFinanceStore } from '../stores/finance.store';
import { useAssetStore } from '../stores/asset.store';
import { Transaction } from '../types';
import { notifySharedTransactionAdded } from '../services/notification.service';

/**
 * Supabase Realtime 구독 훅
 * 루트 레이아웃에서 마운트하여 단일 WebSocket 연결 유지
 */
export function useRealtime(userId: string | undefined) {
  const { handleRealtimeEvent: handleTodoEvent } = useTodoStore();
  const { handleRealtimeEvent: handleFinanceEvent, invalidateMonth } = useFinanceStore();
  const { refreshBalances } = useAssetStore();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-${userId}`)
      // 할일 변경 구독
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
        },
        (payload) => {
          handleTodoEvent(payload as any);
        }
      )
      // 거래 변경 구독
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const tx = payload.new as Transaction;
            if (tx?.user_id && tx.user_id !== userId) {
              void notifySharedTransactionAdded(tx);
            }
          }

          handleFinanceEvent(payload as any);
          // 자산 잔액 갱신
          void refreshBalances(userId).catch((error) => {
            console.warn('[Realtime] 자산 잔액 갱신에 실패했습니다.', error);
          });
          // 해당 월 요약 캐시 무효화
          const record = (payload.new || payload.old) as Transaction;
          if (record?.transaction_date) {
            const [year, month] = record.transaction_date.split('-').map(Number);
            invalidateMonth(year, month);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] transactions/todos 구독 연결됨');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] 구독 채널 오류가 발생했습니다.');
        } else if (status === 'TIMED_OUT') {
          console.warn('[Realtime] 구독 채널 연결이 시간 초과되었습니다.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
