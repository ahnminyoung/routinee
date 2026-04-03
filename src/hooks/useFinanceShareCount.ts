import { useCallback, useEffect, useState } from 'react';
import { collabService } from '../services/collab.service';

export function useFinanceShareCount(userId?: string) {
  const [sharedCount, setSharedCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSharedCount(0);
      return;
    }
    try {
      const members = await collabService.fetchFinanceConnections(userId);
      setSharedCount(members.filter((m) => m.share_finance).length);
    } catch (error) {
      console.warn('[FinanceShare] 공유 멤버 조회에 실패했습니다.', error);
      setSharedCount(0);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    sharedCount,
    isShared: sharedCount > 0,
    refresh,
  };
}
