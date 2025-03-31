// src/hooks/api/useAuth.ts
import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  getAuthToken,
  storeAuthToken,
  removeAuthToken,
} from "../../utils/authTokenUtils";
import { User, AuthContextType } from "../../types";
import apiClient, {ApiError} from "../../api/client";

/**
 * Interface for login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Interface for registration data
 */
export interface RegistrationData {
  email: string;
  password: string;
  name?: string;
}

/**
 * Hook for authentication operations
 */
export function useAuth(): AuthContextType {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  // loading starts true to handle initial user load check
  const [loading, setLoading] = useState<boolean>(true);
  // error state specifically for non-form-related auth issues (e.g., initial load)
  const [error, setError] = useState<string | null>(null);

  // Effect to handle global auth errors signaled by the API client interceptor
  useEffect(() => {
    const handleGlobalAuthError = () => {
      console.debug("useAuth handling auth-error event");
      // Clear local auth state
      removeAuthToken();
      setToken(null);
      setUser(null);
      setError("Your session has expired. Please log in again."); // Set an informative error
      setLoading(false); // Ensure loading is stopped

      // Redirect to login, replacing history
      navigate("/login", { replace: true });
    };

    // Listen for the custom event fired by the interceptor
    window.addEventListener("auth-error", handleGlobalAuthError);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener("auth-error", handleGlobalAuthError);
    };
  }, [navigate]); // Dependency: navigate function

  // Effect to load user data on initial mount or when token changes (e.g., after login)
  useEffect(() => {
    const loadUser = async () => {
      // Don't try to load if there's no token
      if (!token) {
        setLoading(false);
        setUser(null); // Ensure user is null if no token
        return;
      }

      setLoading(true); // Set loading true for the /auth/me call
      setError(null); // Clear previous errors

      try {
        // This call will now go through the interceptors
        const data = await apiClient.get<{ user: User }>("/auth/me");
        setUser(data.user);
        setError(null);
      } catch (err) {
        // The interceptor might have already fired 'auth-error' if it was a 401.
        // This catch handles the specific error from *this* request.
        // It's okay if cleanup runs twice (here and in event listener) - it's idempotent.
        const apiError = err as ApiError;
        console.error("Failed to load user:", apiError.message, apiError);

        // If it wasn't a 401 handled globally, or if we need to ensure state is cleared
        if (!apiError.isAuthError) {
           removeAuthToken(); // Ensure cleanup even if not 401
           setToken(null);
           setUser(null);
        }
        // Set a specific error for the user load failure
        setError(apiError.message || "Failed to verify session. Please log in again.");
      } finally {
        setLoading(false); // Ensure loading is always stopped
      }
    };

    loadUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]); // Rerun only when the token state changes

  /**
   * Login user. Errors are now primarily handled by the calling component (Formik status)
   * based on the enhanced error thrown from here.
   */
  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean = false) => {
      setLoading(true);
      setError(null); // Clear hook-level errors on new attempt
      try {
        const response = await apiClient.post<{ token: string; user: User }>(
          "/auth/login",
          { email, password },
        );
        const { token: authToken, user: userData } = response;

        storeAuthToken(authToken, rememberMe);
        setToken(authToken); // This triggers the useEffect to load user data again if needed
        setUser(userData); // Optimistically set user, useEffect will verify
        // No need to setError here on success
      } catch (err) {
        // Interceptor provides enhanced error with a user-friendly message
        const apiError = err as ApiError;
        throw apiError; // Throw the enhanced error
      } finally {
        setLoading(false);
      }
    },
    [], // No dependencies needed for login logic itself
  );

  /**
   * Register user. Errors handled similarly to login.
   */
  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      setLoading(true);
      setError(null); // Clear hook-level errors
      try {
        const response = await apiClient.post<{ token: string; user: User }>(
          "/auth/register",
          { email, password, name },
        );
        const { token: authToken, user: userData } = response;

        // For registration, we'll use sessionStorage by default
        storeAuthToken(authToken, false);
        setToken(authToken); // Triggers user load/verification
        setUser(userData); // Optimistic update
      } catch (err) {
        const apiError = err as ApiError;
        console.error("Registration failed:", apiError);
        // Re-throw for the form handler
        throw apiError;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Logout the current user.
   */
  const logout = useCallback(() => {
    // Optionally call a backend logout endpoint if it exists
    // apiClient.post('/auth/logout').catch(err => console.error("Logout API call failed", err));

    removeAuthToken();
    setToken(null);
    setUser(null);
    setError(null); // Clear any lingering errors
    navigate("/login", { replace: true }); // Use replace to prevent back button going to protected route
  }, [navigate]);

  return {
    user,
    token,
    // Provide loading state reflecting initial load and login/register attempts
    loading,
    // Provide hook-level error state primarily for initial load issues
    error,
    login,
    register,
    logout,
  };
}

export default useAuth;