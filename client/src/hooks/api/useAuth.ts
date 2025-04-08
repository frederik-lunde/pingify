// src/hooks/api/useAuth.ts
import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAuthToken,
  storeAuthToken,
  removeAuthToken,
} from "../../utils/authTokenUtils";
import { User, AuthContextType, ApiError } from "../../types";
import {
    fetchCurrentUser,
    loginUser,
    registerUser,
    AuthResponse,
    LoginCredentials,
    RegistrationData
} from "../../api/authApi";

export const authQueryKeys = {
    me: ['auth', 'me'] as const,
};

/**
 * Hook managing core authentication state
 */
export function useAuthCore(): Omit<AuthContextType, 'login' | 'register'> {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [token, setToken] = useState<string | null>(getAuthToken);

  const [isInitialCheckComplete, setIsInitialCheckComplete] = useState(false);

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
    if (!token) {
      setIsInitialCheckComplete(true); 
    } else if (isUserQuerySuccess || isUserQueryError) {
      setIsInitialCheckComplete(true); 
    }
  }, [token, isUserQuerySuccess, isUserQueryError, isInitialCheckComplete]);

  const loading = !isInitialCheckComplete;

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
        if (event.key === "authToken" || (event.storageArea === sessionStorage && event.key === null)) {
             const currentToken = getAuthToken();
             if (token !== currentToken) {
                 setToken(currentToken);
                 if (!currentToken) {
                    queryClient.setQueryData(authQueryKeys.me, null);
                 }
                 queryClient.invalidateQueries({ queryKey: authQueryKeys.me });
             }
        }
    };
    window.addEventListener('storage', syncToken);
    return () => window.removeEventListener('storage', syncToken);
  }, [queryClient, token]);

  // Logout Function
  const logout = useCallback(() => {
    removeAuthToken();
    setToken(null);
    queryClient.setQueryData(authQueryKeys.me, null); 
    queryClient.removeQueries({ queryKey: authQueryKeys.me });
    setIsInitialCheckComplete(true); // Check is complete (no user)
    // Consider resetting other queries if needed: queryClient.resetQueries();
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