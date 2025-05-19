/**
 * Retrieves the authentication token from local or session storage.
 */
export const getAuthToken = (): string | null => {
  try {
    const localToken = localStorage.getItem("authToken");
    if (localToken) return localToken;
    const sessionToken = sessionStorage.getItem("authToken");
    return sessionToken;
  } catch (error) {
      console.error("Failed to access browser storage for auth token:", error);
      return null;
  }
};

/**
 * Stores the authentication token in local or session storage.
 */
export const storeAuthToken = (token: string, rememberMe: boolean): void => {
  try {
      if (rememberMe) {
        localStorage.setItem("authToken", token);
        sessionStorage.removeItem("authToken");
      } else {
        sessionStorage.setItem("authToken", token);
        localStorage.removeItem("authToken");
      }
  } catch (error) {
       console.error("Failed to store auth token in browser storage:", error);
  }
};

/**
 * Removes the authentication token from both local and session storage.
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
 * Dispatches a custom 'auth-error'
 */
export const fireAuthErrorEvent = (): void => {
  console.debug("Firing auth-error event");
  window.dispatchEvent(
    new CustomEvent("auth-error", { detail: "Unauthorized API access detected" }),
  );
};