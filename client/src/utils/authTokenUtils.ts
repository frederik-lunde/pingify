// src/utils/authTokenUtils.ts
// Central location for token management utilities

/**
 * Gets auth token from either localStorage or sessionStorage.
 * Prefers localStorage (persistent) over sessionStorage (session-only).
 */
export const getAuthToken = (): string | null => {
  try {
    // First try localStorage (for "Remember Me" users)
    const localToken = localStorage.getItem("authToken");
    if (localToken) return localToken;

    // Then try sessionStorage (for regular session users)
    const sessionToken = sessionStorage.getItem("authToken");
    return sessionToken;
  } catch (error) {
      // Handle potential SecurityError if storage access is restricted (e.g., in private browsing, some iframes)
      console.error("Failed to access browser storage for auth token:", error);
      return null;
  }
};

/**
 * Stores auth token based on remember me preference.
 * Clears the other storage type to avoid conflicts.
 */
export const storeAuthToken = (token: string, rememberMe: boolean): void => {
  try {
      if (rememberMe) {
        localStorage.setItem("authToken", token);
        sessionStorage.removeItem("authToken"); // Clear session storage
      } else {
        sessionStorage.setItem("authToken", token);
        localStorage.removeItem("authToken"); // Clear local storage
      }
  } catch (error) {
       console.error("Failed to store auth token in browser storage:", error);
  }
};

/**
 * Removes auth token from all storage locations.
 */
export const removeAuthToken = (): void => {
  try {
      localStorage.removeItem("authToken");
      sessionStorage.removeItem("authToken");
  } catch (error) {
       console.error("Failed to remove auth token from browser storage:", error);
  }
};

/**
 * Custom event used by the API client interceptor to signal an authentication error (e.g., 401)
 * that requires global handling (logout and redirect).
 */
export const fireAuthErrorEvent = (): void => {
  console.debug("Firing auth-error event"); // Optional: for debugging
  window.dispatchEvent(
    new CustomEvent("auth-error", { detail: "Unauthorized API access detected" }),
  );
};