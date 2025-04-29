// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
// Assuming ApiError is defined and exported correctly, possibly from client.ts or a types file
import { ApiError } from '../types'; // Adjust path if needed, e.g., '../types'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      gcTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error: unknown) => {
        const apiError = error as ApiError; // Type assertion
        if (apiError?.status === 404 || apiError?.status === 401 || apiError?.status === 403) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: true,
    },
    mutations: {
       retry: 0,
    }
  },
});

// Export DevTools component if you want to use it easily
export const ReactQueryDevtoolsProduction = import.meta.env.MODE === 'production'
  ? () => null // Render nothing in production
  : ReactQueryDevtools; // Render DevTools otherwise

export default queryClient; // Export the instance for use in your app