// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'; // Optional but recommended
import { ApiError } from '../types'; // Import your ApiError type

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default staleTime: How long data is considered fresh (0 means always stale)
      // Consider setting a default staleTime globally or per-query based on needs
      // staleTime: 1000 * 60 * 1, // e.g., 1 minute
      staleTime: 0, // Default to immediate refetch on mount/focus unless specified otherwise

      // Default gcTime (cacheTime): How long inactive data stays in cache (5 minutes default)
      gcTime: 1000 * 60 * 5, // 5 minutes

      // Retry configuration
      retry: (failureCount, error: unknown) => {
        const apiError = error as ApiError; // Type assertion
        // Don't retry on 404 or 401/403 errors
        if (apiError?.status === 404 || apiError?.status === 401 || apiError?.status === 403) {
          return false;
        }
        // Retry up to 2 times for other errors (total 3 attempts)
        return failureCount < 2;
      },

      // Refetch configuration (can be overridden per query)
      refetchOnWindowFocus: true, // Refetch when window regains focus
      // refetchOnMount: true, // Already the default behaviour
      // refetchOnReconnect: true, // Already the default behaviour
    },
    mutations: {
       retry: 0, // Typically don't retry mutations unless idempotent
    }
  },
});

// Export DevTools component if you want to use it easily
// Render nothing in production, DevTools otherwise
export const ReactQueryDevtoolsProduction = process.env.NODE_ENV === 'production'
  ? () => null
  : ReactQueryDevtools;

  export default queryClient; // Export the instance for use in your app