// src/hooks/common/usePolling.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_POLLING_INTERVAL } from '../../api/config';

/**
 * Options for the usePolling hook
 */
export interface PollingOptions<T> {
  /** Initial data to use before the first fetch completes */
  initialData?: T;
  
  /** How often to poll in milliseconds */
  pollingInterval?: number;
  
  /** Whether polling should be enabled */
  enabled?: boolean;
  
  /** Whether to fetch immediately on mount */
  fetchOnMount?: boolean;
  
  /** Callback for successful fetches */
  onSuccess?: (data: T) => void;
  
  /** Callback for failed fetches */
  onError?: (error: Error) => void;
}

/**
 * Return type for the usePolling hook
 */
export interface PollingResult<T> {
  /** The fetched data */
  data: T | null;
  
  /** Whether a fetch is in progress */
  loading: boolean;
  
  /** Any error that occurred during fetching */
  error: Error | null;
  
  /** Function to manually trigger a fetch */
  refetch: () => Promise<void>;
  
  /** Function to stop polling */
  stopPolling: () => void;
  
  /** Function to start polling */
  startPolling: () => void;
}

/**
 * A hook that handles polling an API endpoint at regular intervals
 * 
 * @param fetchFunction The function to call for fetching data
 * @param options Configuration options for polling
 * @returns Object containing data, loading state, error, and control functions
 */
export function usePolling<T>(
  fetchFunction: () => Promise<T>,
  options: PollingOptions<T> = {}
): PollingResult<T> {
  // Default options
  const {
    initialData = null,
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    enabled = true,
    fetchOnMount = true,
    onSuccess,
    onError
  } = options;

  // State
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState<boolean>(fetchOnMount);
  const [error, setError] = useState<Error | null>(null);
  
  // Use refs to track polling state
  const isPollingEnabled = useRef<boolean>(enabled);
  const intervalId = useRef<number | null>(null);
  const isMounted = useRef<boolean>(false);

  // Function to fetch data
  const fetchData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const result = await fetchFunction();
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        setData(result);
        setError(null);
        if (onSuccess) onSuccess(result);
      }
    } catch (err) {
      // Only update state if component is still mounted
      if (isMounted.current) {
        const errorObject = err instanceof Error ? err : new Error('Failed to fetch data');
        setError(errorObject);
        if (onError) onError(errorObject);
        console.error('Error in polling fetch:', errorObject);
      }
    } finally {
      // Only update state if component is still mounted
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [fetchFunction, onSuccess, onError]);

  // Start polling
  const startPolling = useCallback(() => {
    if (isPollingEnabled.current) return;
    
    isPollingEnabled.current = true;
    // Perform an immediate fetch when starting
    fetchData();
    
    // Only set up interval if polling interval is positive
    if (pollingInterval > 0) {
      intervalId.current = window.setInterval(fetchData, pollingInterval);
    }
  }, [fetchData, pollingInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (!isPollingEnabled.current) return;
    
    isPollingEnabled.current = false;
    
    if (intervalId.current !== null) {
      window.clearInterval(intervalId.current);
      intervalId.current = null;
    }
  }, []);

  // Effect to set up and clean up polling
  useEffect(() => {
    isMounted.current = true;
    
    // Initial fetch if enabled and fetchOnMount is true
    if (fetchOnMount) {
      fetchData();
    }
    
    // Set up polling if enabled and interval is positive
    if (enabled && pollingInterval > 0) {
      isPollingEnabled.current = true;
      intervalId.current = window.setInterval(fetchData, pollingInterval);
    } else {
      isPollingEnabled.current = false;
    }
    
    // Clean up on unmount or when dependencies change
    return () => {
      isMounted.current = false;
      if (intervalId.current !== null) {
        window.clearInterval(intervalId.current);
        intervalId.current = null;
      }
    };
  }, [enabled, pollingInterval, fetchData, fetchOnMount]);

  // Update polling interval or enabled state if options change
  useEffect(() => {
    // If polling is enabled and the interval changed, restart the polling
    if (isPollingEnabled.current && intervalId.current !== null && pollingInterval > 0) {
      window.clearInterval(intervalId.current);
      intervalId.current = window.setInterval(fetchData, pollingInterval);
    }
    
    // Handle enabled state change
    if (enabled !== isPollingEnabled.current) {
      if (enabled && pollingInterval > 0) {
        startPolling();
      } else {
        stopPolling();
      }
    }
  }, [enabled, pollingInterval, fetchData, startPolling, stopPolling]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    stopPolling,
    startPolling
  };
}

export default usePolling;