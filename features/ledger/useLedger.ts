import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { fetchLedger } from '@/features/ledger/api';

export const LEDGER_KEY = ['ledger'] as const;

/** The signed-in user's groups, expenses and settlements. Shared by every data screen. */
export function useLedger() {
  return useQuery({ queryKey: LEDGER_KEY, queryFn: fetchLedger });
}

/** Call after any change to money or membership so every screen recalculates. */
export function useInvalidateLedger() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: LEDGER_KEY }), [queryClient]);
}

/** Pull-to-refresh state that only spins for a refresh the user asked for. */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  }, [refetch]);
  return { refreshing, onRefresh };
}
