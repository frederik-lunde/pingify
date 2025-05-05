/*
src/hooks/api/useAuth.ts
*/
import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAuthToken,
  storeAuthToken,
  removeAuthToken,
} from "../../utils/authTokenUtils";
import { User, ApiError, AuthResponse, LoginCredentials, RegisterUserData} from "../../types";
import {
    fetchCurrentUser,
    loginUser,
    registerUser,

} from "../../api/authApi";

export const authQueryKeys = {
    me: ['auth', 'me'] as const,
};

/**
 * Hook managing core authentication state
 */
// Removed Omit<AuthContextType...> as it wasn't fully used and the type wasn't imported
export function useAuthCore() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [token, setToken] = useState<string | null>(getAuthToken);

  // Tracks if the initial check for user data (based on token) has finished
  const [isInitialCheckComplete, setIsInitialCheckComplete] = useState(false);

  const {
      data: userData,
      isSuccess: isUserQuerySuccess,
      isError: isUserQueryError,
      error: userQueryErrorData,
  } = useQuery<{ user: User }, ApiError>({
      queryKey: authQueryKeys.me,
      queryFn: fetchCurrentUser,
      enabled: !!token,
      staleTime: 1000 * 60 * 30, // 30 minutes
      gcTime: 1000 * 60 * 60,    // 1 hour
      retry: (failureCount, error) => {
         if (error?.status === 401 || error?.status === 403) return false;
         return failureCount < 1;
      },
      refetchOnWindowFocus: true,
  });

  const user = userData?.user || null;

  useEffect(() => {
    if (isInitialCheckComplete) return;
    // Mark as complete if there's no token initially
    if (!token) {
      setIsInitialCheckComplete(true);
    // Mark as complete once the query finishes (successfully or with error) when a token exists
    } else if (isUserQuerySuccess || isUserQueryError) {
      setIsInitialCheckComplete(true);
    }
  }, [token, isUserQuerySuccess, isUserQueryError, isInitialCheckComplete]);

  // Loading is true until the initial check completes
  const loading = !isInitialCheckComplete;

  // Error is relevant only after the initial check is done, a token existed, and the query failed
  const error = (isInitialCheckComplete && token && isUserQueryError)
      ? (userQueryErrorData?.message || "Failed to load user data.")
      : null;

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

  // Token Synchronization Listener
  useEffect(() => {
    const syncToken = (event: StorageEvent) => {
        // Check if the event is for the authToken or a general storage clear event
        if (event.key === "authToken" || (event.storageArea === sessionStorage && event.key === null) || (event.storageArea === localStorage && event.key === null)) {
             const currentToken = getAuthToken();
             if (token !== currentToken) {
                 console.debug("Auth token changed in another tab/window. Syncing state.");
                 setToken(currentToken);
                 // If token removed, clear user data immediately
                 if (!currentToken) {
                    queryClient.setQueryData(authQueryKeys.me, null);
                 }
                 // Invalidate to refetch user data if token was added/changed
                 queryClient.invalidateQueries({ queryKey: authQueryKeys.me });
             }
        }
    };
    window.addEventListener('storage', syncToken);
    return () => window.removeEventListener('storage', syncToken);
  }, [queryClient, token]);

  // Logout Function
  const logout = useCallback(() => {
    console.debug("User logout initiated.");
    removeAuthToken();
    setToken(null);
    queryClient.setQueryData(authQueryKeys.me, null);
    queryClient.removeQueries({ queryKey: authQueryKeys.me });
    setIsInitialCheckComplete(true); // Check is complete (no user)
    // Resetting all queries might be too broad, but consider if specific domains need clearing
    // queryClient.resetQueries();
    navigate("/login", { replace: true });
  }, [navigate, queryClient]);


  return {
    user,
    token,
    loading,
    error,
    logout,
  };
}



/**
 * Hook providing a mutation for user login.
 * Handles API call, token storage, and cache invalidation upon success.
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
            // Invalidate to ensure it fetches fresh data if needed or confirms the cached data
            // This might be slightly redundant if setQueryData is trusted, but safe.
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

    return useMutation<AuthResponse, ApiError, RegisterUserData>({
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