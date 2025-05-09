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

/**
 * Defines query keys for authentication-related data.
 */
export const authQueryKeys = {
    me: ['auth', 'me'] as const,
};

/**
 * Core authentication hook managing user state, token, loading, and errors.
 */
export function useAuthCore() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(getAuthToken);
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
      staleTime: 1000 * 60 * 30,
      gcTime: 1000 * 60 * 60,
      retry: (failureCount, error) => {
         if (error?.status === 401 || error?.status === 403) return false;
         return failureCount < 1;
      },
      refetchOnWindowFocus: true,
  });
  const user = userData?.user || null;

  /**
   * Effect to track the completion of the initial authentication check.
   */
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

  /**
   * Effect to handle global authentication errors (e.g., 401 from API).
   */
  useEffect(() => {
    const handleGlobalAuthError = () => {
      console.debug("useAuthCore handling auth-error event (likely 401 from non-auth endpoint)");
      removeAuthToken();
      setToken(null);
      queryClient.setQueryData(authQueryKeys.me, null);
      queryClient.removeQueries({ queryKey: authQueryKeys.me });
      setIsInitialCheckComplete(true);
      navigate("/login", { replace: true });
    };
    window.addEventListener("auth-error", handleGlobalAuthError);
    return () => window.removeEventListener("auth-error", handleGlobalAuthError);
  }, [navigate, queryClient]);

  /**
   * Effect to synchronize authentication token across browser tabs/windows.
   */
  useEffect(() => {
    const syncToken = (event: StorageEvent) => {
        if (event.key === "authToken" || (event.storageArea === sessionStorage && event.key === null) || (event.storageArea === localStorage && event.key === null)) {
             const currentToken = getAuthToken();
             if (token !== currentToken) {
                 console.debug("Auth token changed in another tab/window. Syncing state.");
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

  /**
   * Logs out the current user.
   */
  const logout = useCallback(() => {
    console.debug("User logout initiated.");
    removeAuthToken();
    setToken(null);
    queryClient.setQueryData(authQueryKeys.me, null);
    queryClient.removeQueries({ queryKey: authQueryKeys.me });
    setIsInitialCheckComplete(true);
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
 * Custom hook for user login mutation.
 */
export function useLoginMutation() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    return useMutation<AuthResponse, ApiError, LoginCredentials & { rememberMe?: boolean }>({
        mutationFn: (credentials) => loginUser(credentials),
        onSuccess: (data, variables) => {
            storeAuthToken(data.token, variables.rememberMe || false);
            queryClient.setQueryData(authQueryKeys.me, { user: data.user });
            queryClient.invalidateQueries({ queryKey: authQueryKeys.me });
            console.log("Login successful via mutation hook");
            navigate("/");
        },
        onError: (error) => {
             console.error("Login mutation failed:", error.message);
        }
    });
}

/**
 * Custom hook for user registration mutation.
 */
export function useRegisterMutation() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    return useMutation<AuthResponse, ApiError, RegisterUserData>({
        mutationFn: registerUser,
        onSuccess: (data) => {
            storeAuthToken(data.token, false);
            queryClient.setQueryData(authQueryKeys.me, { user: data.user });
            queryClient.invalidateQueries({ queryKey: authQueryKeys.me });
            console.log("Registration successful via mutation hook");
            navigate("/");
        },
        onError: (error) => {
            console.error("Registration mutation failed:", error.message);
        }
    });
}