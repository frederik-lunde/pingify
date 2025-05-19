import { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ApiError } from '../types';


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      gcTime: 1000 * 60 * 5,
      
      retry: (failureCount, error: unknown) => {
        const apiError = error as ApiError;
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


export const ReactQueryDevtoolsProduction = import.meta.env.MODE === 'production'
  ? () => null
  : ReactQueryDevtools;

export default queryClient;