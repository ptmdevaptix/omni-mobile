import { useCallback, useState } from 'react';

// RefreshControl's `refreshing` must reflect ONLY a user-initiated pull — never React Query's
// background refetches (refetchInterval, refetch-on-mount). Binding it to `isRefetching` makes the
// spinner appear on its own while sitting on a loaded page, and linger if a background fetch stalls.
export function usePullRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);
  return { refreshing, onRefresh };
}
