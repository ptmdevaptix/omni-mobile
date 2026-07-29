import { QueryClient } from "@tanstack/react-query";

// Single app-wide query client. Defaults tuned for a live-sports client:
// - data is "fresh" for 30s (avoids refetch storms when navigating tabs),
// - kept in cache 5 min, retried twice. Live screens override with refetchInterval (15s) per the spec.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      // Interval-based freshness is enough; focus-refetch can storm if the app's focus state flaps.
      refetchOnWindowFocus: false,
    },
  },
});
