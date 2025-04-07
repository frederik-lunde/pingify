// src/hooks/api/useAuth.ts
import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAuthToken,
  storeAuthToken,
  removeAuthToken,
} from "../../utils/authTokenUtils"; // Adjust path if needed
import { User, AuthContextType, ApiError } from "../../types"; // Adjust path if needed
import {
    fetchCurrentUser,
    loginUser,
    registerUser,
    AuthResponse,
    LoginCredentials,
    RegistrationData
} from "../../api/authApi"; // Adjust path if needed

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
      error: userQueryErrorData,
      isFetching: isUserQueryFetching,
  } = useQuery<{ user: User }, ApiError>({
      queryKey: authQueryKeys.me,
      queryFn: fetchCurrentUser,
      enabled: !!token,
      staleTime: 1000 * 60 * 30,
      gcTime: 1000 * 60 * 60,
      retry: (failureCount, error) => {
         if (error?.status === 401 || error?.status === 403) return false;
         return failureCount < 1;
      },
      refetchOnWindowFocus: true,
  });

  // Derived State for Context
  const user = userData?.user || null;
  const userId = user?.id; // Extract userId for convenience elsewhere if needed

  // Determine completion of the initial auth check
  useEffect(() => {
    if (isInitialCheckComplete) return;
    if (!token) {
      setIsInitialCheckComplete(true);
    } else if (isUserQuerySuccess || isUserQueryError) {
      setIsInitialCheckComplete(true);
    }
  }, [token, isUserQuerySuccess, isUserQueryError, isInitialCheckComplete]);

  // Loading state for ProtectedRoute
  const loading = !isInitialCheckComplete;

  // Error state
  const error = (isInitialCheckComplete && token && isUserQueryError)
      ? (userQueryErrorData?.message || "Failed to load user data.")
      : null;

  // Global Auth Error Listener
  useEffect(() => {
    const handleGlobalAuthError = () => {
      console.debug("useAuthCore handling auth-error event (likely 401 from non-auth endpoint)");
      const userWasLoggedIn = !!getAuthToken(); // Check before removing
      removeAuthToken();
      setToken(null);
      // ---> Clear the entire cache on auth error too <---
      queryClient.clear();
      setIsInitialCheckComplete(true);
      if (userWasLoggedIn) {
          navigate("/login", { replace: true });
      }
    };
    window.addEventListener("auth-error", handleGlobalAuthError);
    return () => window.removeEventListener("auth-error", handleGlobalAuthError);
    // Ensure queryClient is stable or add to dependencies if needed, though unlikely to change
  }, [navigate, queryClient]); // Added queryClient dependency

  // Token Synchronization Listener
  useEffect(() => {
    const syncToken = (event: StorageEvent) => {
        if (event.key === "authToken" || (event.storageArea === sessionStorage && event.key === null)) {
             const currentToken = getAuthToken();
             if (token !== currentToken) {
                 setToken(currentToken);
                 // Invalidate 'me' query to refetch user if token changes/appears
                 // No need to clear cache here, just refetch auth state
                 queryClient.invalidateQueries({ queryKey: authQueryKeys.me });
             }
        }
    };
    window.addEventListener('storage', syncToken);
    return () => window.removeEventListener('storage', syncToken);
  }, [queryClient, token]);

  // Logout Function
  const logout = useCallback(() => {
    const userWasLoggedIn = !!getAuthToken(); // Check if someone was actually logged in before clearing
    console.log("Logout initiated...");

    removeAuthToken();
    setToken(null);

    // ---> Clear the ENTIRE React Query cache <---
    // This removes ALL cached data (websites, stats, results, auth, etc.)
    // ensuring a clean slate for the next login.
    queryClient.clear();

    setIsInitialCheckComplete(true); // Reset auth check state

    console.log("User logged out, QueryClient cache cleared.");

    // Navigate after clearing cache, only if someone was logged in
    if (userWasLoggedIn) {
        navigate("/login", { replace: true });
    }
  }, [navigate, queryClient]); // queryClient is a dependency

  // Return Value for Context Provider
  return {
    user,
    token,
    loading,
    error,
    logout,
  };
}


// --- MUTATION HOOKS ---

/**
 * Hook providing a mutation for user login.
 */
export function useLoginMutation() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    return useMutation<AuthResponse, ApiError, LoginCredentials & { rememberMe?: boolean }>({
        mutationFn: (credentials) => loginUser(credentials),
        onSuccess: (data, variables) => {
            storeAuthToken(data.token, variables.rememberMe || false);
            // Set user data in cache immediately for faster UI update
            queryClient.setQueryData(authQueryKeys.me, { user: data.user });
            // Invalidate *just in case* but setQueryData usually suffices
            // queryClient.invalidateQueries({ queryKey: authQueryKeys.me });

            // ---> Crucially, invalidate other potentially stale user data from previous sessions if any existed <---
            // Or rely on the fact that new queries with the correct userId will run.
            // A simple invalidate might be good practice after login.
            queryClient.invalidateQueries({ queryKey: ['websites'] }); // Invalidate website lists
            queryClient.invalidateQueries({ queryKey: ['monitoring'] }); // Invalidate monitoring data

            console.log("Login successful via mutation hook");
            navigate("/");
        },
        onError: (error) => {
             console.error("Login mutation failed:", error.message);
        }
    });
}

/**
 * Hook providing a mutation for user registration.
 */
export function useRegisterMutation() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    return useMutation<AuthResponse, ApiError, RegistrationData>({
        mutationFn: registerUser,
        onSuccess: (data) => {
            storeAuthToken(data.token, false);
            queryClient.setQueryData(authQueryKeys.me, { user: data.user });
            // queryClient.invalidateQueries({ queryKey: authQueryKeys.me });

            // Invalidate other data areas as well after registration
            queryClient.invalidateQueries({ queryKey: ['websites'] });
            queryClient.invalidateQueries({ queryKey: ['monitoring'] });

            console.log("Registration successful via mutation hook");
            navigate("/");
        },
        onError: (error) => {
            console.error("Registration mutation failed:", error.message);
        }
    });
}