// src/hooks/common/usePolling.ts
import { useEffect, useCallback, useRef, useReducer } from 'react';
import { DEFAULT_POLLING_INTERVAL } from '../../api/config';
import isEqual from 'lodash/isEqual';


export interface PollingOptions<T> {
  initialData?: T;
  pollingInterval?: number;
  enabled?: boolean;
  fetchOnMount?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  respectVisibility?: boolean;
}

export interface PollingResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  stopPolling: () => void;
  startPolling: () => void; // Keep explicit start for flexibility
  fetchCount: number;
  setData: (updater: T | null | ((currentData: T | null) => T | null)) => void;
}

// --- Reducer types (PollingState, PollingAction with DIRECT_SET_DATA) ---
// These remain unchanged.
type PollingState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
  fetchCount: number;
};

type PollingAction<T> =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: T }
  | { type: 'FETCH_ERROR'; payload: Error }
  | { type: 'RESET_ERROR' }
  | { type: 'DIRECT_SET_DATA'; payload: T | null };

// --- Reducer Function ---
// Stays the same, ensuring FETCH_START clears errors.
function createPollingReducer<T>() {
  return function reducer(state: PollingState<T>, action: PollingAction<T>): PollingState<T> {
    switch (action.type) {
      case 'FETCH_START':
        return { ...state, loading: true, error: null }; // Clear error on start
      case 'FETCH_SUCCESS':
        { const dataChanged = !isEqual(state.data, action.payload);
        return dataChanged
          ? {
              ...state,
              data: action.payload,
              loading: false,
              error: null,
              fetchCount: state.fetchCount + 1
            }
          : {
              ...state,
              loading: false,
              error: null
            }; }
      case 'FETCH_ERROR':
        return { ...state, loading: false, error: action.payload };
      case 'RESET_ERROR':
        return { ...state, error: null };
      case 'DIRECT_SET_DATA':
        return {
          ...state,
          data: action.payload,
        };
      default:
        return state;
    }
  };
}

// --- The Hook ---
export function usePolling<T>(
  fetchFunction: () => Promise<T>,
  options: PollingOptions<T> = {}
): PollingResult<T> {
  const {
    initialData = null,
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    enabled = true,
    fetchOnMount = true,
    onSuccess,
    onError,
    respectVisibility = true
  } = options;

  // Ref to always hold the latest fetch function
  const fetchFunctionRef = useRef(fetchFunction);
  useEffect(() => {
    fetchFunctionRef.current = fetchFunction;
  }, [fetchFunction]);

  // Reducer for state management
  const reducer = useRef(createPollingReducer<T>()).current;
  const [state, dispatch] = useReducer(reducer, {
    data: initialData,
    // Initial loading: true only if enabled, fetching on mount, and no initial data provided
    loading: enabled && fetchOnMount && initialData === null,
    error: null,
    fetchCount: 0
  });

  // Refs to manage polling state without causing re-renders
  const intervalId = useRef<number | null>(null);
  const isMounted = useRef<boolean>(false);
  const isPollingActive = useRef<boolean>(false); // Tracks if interval is currently set

  // --- Core Fetch Logic ---
  // useCallback ensures refetch is stable unless onSuccess/onError change
  const refetch = useCallback(async (): Promise<void> => {
    if (!isMounted.current) return; // Prevent updates on unmounted component

    dispatch({ type: 'FETCH_START' });
    try {
      const result = await fetchFunctionRef.current(); // Always use the latest function
      if (isMounted.current) {
        dispatch({ type: 'FETCH_SUCCESS', payload: result });
        if (onSuccess) onSuccess(result);
      }
    } catch (err) {
      if (isMounted.current) {
        const errorObject = err instanceof Error ? err : new Error('Failed to fetch data');
        dispatch({ type: 'FETCH_ERROR', payload: errorObject });
        if (onError) onError(errorObject);
        console.error('Error during fetch:', errorObject);
      }
    }
  }, [onSuccess, onError]); // Depends only on the callbacks it uses

  // --- Polling Control Functions ---
  const stopPolling = useCallback(() => {
    if (intervalId.current !== null) {
      window.clearInterval(intervalId.current);
      intervalId.current = null;
    }
    isPollingActive.current = false;
  }, []);

  const startPolling = useCallback(() => {
    // Don't start if already active, interval is invalid, or hook disabled
    if (isPollingActive.current || pollingInterval <= 0 || !enabled) {
      return;
    }

    isPollingActive.current = true;

    // Function to perform a poll check respecting visibility
    const performPollCheck = () => {
      if (!isMounted.current) {
        stopPolling(); // Stop if component unmounted
        return;
      }
      const isVisible = !respectVisibility || document.visibilityState === 'visible';
      if (isVisible) {
        refetch();
      }
    };

    // Perform initial check immediately upon starting (if visible)
    performPollCheck();

    // Set up the interval
    intervalId.current = window.setInterval(performPollCheck, pollingInterval);

  }, [enabled, pollingInterval, refetch, respectVisibility, stopPolling]);


  // --- setData Function ---
  // Remains the same, dispatches DIRECT_SET_DATA
  const setData = useCallback((updater: T | null | ((currentData: T | null) => T | null)) => {
    dispatch({
        type: 'DIRECT_SET_DATA',
        payload: typeof updater === 'function'
            ? (updater as (currentData: T | null) => T | null)(state.data)
            : updater
    });
  }, [state.data]);

  // --- Effects ---

  // Effect for mounting and initial setup/cleanup
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      stopPolling(); // Ensure polling stops on unmount
    };
  }, [stopPolling]); // Depends only on stopPolling for cleanup

  useEffect(() => {
    if (enabled) {
      if (fetchOnMount && isMounted.current && !isPollingActive.current) {
          const isVisible = !respectVisibility || document.visibilityState === 'visible';
          if (isVisible) {
             refetch();
          }
      }
      startPolling(); // Start or restart polling if interval changed
    } else {
      stopPolling(); // Stop polling if disabled
    }

    // Cleanup within this effect scope if needed (handled by stopPolling call)
  }, [enabled, pollingInterval, fetchOnMount, startPolling, stopPolling, refetch, respectVisibility]); // Re-evaluate polling when these change


  // --- Return Value ---
  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refetch,
    stopPolling,
    startPolling,
    fetchCount: state.fetchCount,
    setData
  };
}

export default usePolling;