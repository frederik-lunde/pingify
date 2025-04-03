// src/hooks/api/useAuth.ts
import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAuthToken,
  storeAuthToken,
  removeAuthToken,
  fireAuthErrorEvent,
} from "../../utils/authTokenUtils"; // Adjust path
import { User, AuthContextType, ApiError } from "../../types"; // Adjust path
import {
    fetchCurrentUser,
    loginUser,
    registerUser,
    AuthResponse,
    LoginCredentials,
    RegistrationData
} from "../../api/authApi"; // Adjust path

// Query Keys
export const authQueryKeys = {
    me: ['auth', 'me'] as const, // Key for the current user query
};

/**
 * Hook managing core authentication state (token, user data via query) and logout.
 * Login and Register are handled via separate mutation hooks.
 * Intended for use by AuthContext provider.
 */
export function useAuthCore(): Omit<AuthContextType, 'login' | 'register'> {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Token State from storage
  const [token, setToken] = useState<string | null>(getAuthToken);

  // Initial Auth Check State
  const [isInitialCheckComplete, setIsInitialCheckComplete] = useState(false);

  // Query for Current User Data
  const {
      data: userData,
      isLoading: isUserQueryLoading,
      isSuccess: isUserQuerySuccess,
      isError: isUserQueryError,
      error: userQueryErrorData, // Rename for clarity
      isFetching: isUserQueryFetching, // Indicates background fetching
  } = useQuery<{ user: User }, ApiError>({
      queryKey: authQueryKeys.me,
      queryFn: fetchCurrentUser,
      enabled: !!token, // Only run if token exists
      staleTime: 1000 * 60 * 30, // 30 minutes
      gcTime: 1000 * 60 * 60,    // 1 hour
      retry: (failureCount, error) => {
         if (error?.status === 401 || error?.status === 403) return false; // No retry on auth errors for /me
         return failureCount < 1; // Retry once for other errors
      },
      refetchOnWindowFocus: true,
  });

  // Derived State for Context
  const user = userData?.user || null;

  // Determine completion of the initial auth check
  useEffect(() => {
    if (isInitialCheckComplete) return;
    if (!token) {
      setIsInitialCheckComplete(true); // No token, check complete
    } else if (isUserQuerySuccess || isUserQueryError) {
      setIsInitialCheckComplete(true); // Token existed, query finished
    }
    // Otherwise, still loading the initial user query
  }, [token, isUserQuerySuccess, isUserQueryError, isInitialCheckComplete]);

  // Loading state for ProtectedRoute: True until initial check is done.
  const loading = !isInitialCheckComplete;

  // Error state: Report error only if check is complete, token existed, and query failed.
  const error = (isInitialCheckComplete && token && isUserQueryError)
      ? (userQueryErrorData?.message || "Failed to load user data.")
      : null;

  // Global Auth Error Listener (handles 401s from *other* API calls)
  useEffect(() => {
    const handleGlobalAuthError = () => {
      console.debug("useAuthCore handling auth-error event (likely 401 from non-auth endpoint)");
      removeAuthToken();
      setToken(null);
      queryClient.setQueryData(authQueryKeys.me, null); // Clear user cache immediately
      queryClient.removeQueries({ queryKey: authQueryKeys.me }); // Remove query to prevent retries
      setIsInitialCheckComplete(true); // Mark check as complete (failed auth)
      navigate("/login", { replace: true });
    };
    window.addEventListener("auth-error", handleGlobalAuthError);
    return () => window.removeEventListener("auth-error", handleGlobalAuthError);
  }, [navigate, queryClient]);

  // Token Synchronization Listener (for multi-tab consistency)
  useEffect(() => {
    const syncToken = (event: StorageEvent) => {
        // Check if the 'authToken' key changed in localStorage or sessionStorage
        if (event.key === "authToken" || (event.storageArea === sessionStorage && event.key === null)) {
             // Re-read token from storage
             const currentToken = getAuthToken();
             // Only update state if the token actually changed
             if (token !== currentToken) {
                 setToken(currentToken);
                 // If token was removed, clear user data immediately
                 if (!currentToken) {
                    queryClient.setQueryData(authQueryKeys.me, null);
                 }
                 // Invalidate the 'me' query to refetch user data if a token now exists
                 queryClient.invalidateQueries({ queryKey: authQueryKeys.me });
             }
        }
    };
    window.addEventListener('storage', syncToken);
    return () => window.removeEventListener('storage', syncToken);
  }, [queryClient, token]); // Depend on queryClient and token

  // Logout Function
  const logout = useCallback(() => {
    removeAuthToken();
    setToken(null);
    queryClient.setQueryData(authQueryKeys.me, null); // Clear user data immediately
    queryClient.removeQueries({ queryKey: authQueryKeys.me }); // Remove the query
    setIsInitialCheckComplete(true); // Check is complete (no user)
    // Consider resetting other queries if needed: queryClient.resetQueries();
    navigate("/login", { replace: true });
  }, [navigate, queryClient]);

  // Return Value for Context Provider
  return {
    user,
    token,
    loading, // Crucial state for initial load indication
    error,   // Error state primarily from the user fetch query
    logout,
  };
}


// --- MUTATION HOOKS ---

/**
 * Hook providing a mutation for user login.
 * Handles API call, token storage, and cache invalidation upon success.
 */
export function useLoginMutation() {
    const queryClient = useQueryClient();
    const navigate = useNavigate(); // To redirect after login

    return useMutation<AuthResponse, ApiError, LoginCredentials & { rememberMe?: boolean }>({
        mutationFn: (credentials) => loginUser(credentials),
        onSuccess: (data, variables) => {
            storeAuthToken(data.token, variables.rememberMe || false);
            // Set user data in cache immediately for faster UI update
            queryClient.setQueryData(authQueryKeys.me, { user: data.user });
            // Invalidate to ensure it fetches fresh data if needed or confirms the cached data
            queryClient.invalidateQueries({ queryKey: authQueryKeys.me });
            console.log("Login successful via mutation hook");
            // Navigate after state update seems likely
            navigate("/"); // Redirect to dashboard on successful login
        },
        onError: (error) => {
             console.error("Login mutation failed:", error.message);
             // Error is returned by the hook for the component to display
        }
    });
}

/**
 * Hook providing a mutation for user registration.
 * Handles API call, token storage, and cache invalidation upon success.
 */
export function useRegisterMutation() {
    const queryClient = useQueryClient();
    const navigate = useNavigate(); // To redirect after registration

    return useMutation<AuthResponse, ApiError, RegistrationData>({
        mutationFn: registerUser,
        onSuccess: (data) => {
            storeAuthToken(data.token, false); // Session only for registration
            queryClient.setQueryData(authQueryKeys.me, { user: data.user });
            queryClient.invalidateQueries({ queryKey: authQueryKeys.me });
            console.log("Registration successful via mutation hook");
            navigate("/"); // Redirect to dashboard
        },
        onError: (error) => {
            console.error("Registration mutation failed:", error.message);
            // Error is returned by the hook for the component to display
        }
    });
}