// client/src/utils/authTokenUtils.ts
// Central location for token management utilities

/**
 * Gets auth token from either localStorage or sessionStorage
 */
export const getAuthToken = (): string | null => {
    // First try localStorage (for "Remember Me" users)
    const localToken = localStorage.getItem('authToken');
    if (localToken) return localToken;
    
    // Then try sessionStorage (for regular session users)
    const sessionToken = sessionStorage.getItem('authToken');
    return sessionToken;
  };
  
  /**
   * Stores auth token based on remember me preference
   */
  export const storeAuthToken = (token: string, rememberMe: boolean): void => {
    if (rememberMe) {
      localStorage.setItem('authToken', token);
      sessionStorage.removeItem('authToken'); // Clear session storage to avoid confusion
    } else {
      sessionStorage.setItem('authToken', token);
      localStorage.removeItem('authToken'); // Clear local storage to avoid confusion
    }
  };
  
  /**
   * Removes auth token from all storage locations
   */
  export const removeAuthToken = (): void => {
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('authToken');
  };
  
  /**
   * Custom event for auth errors
   */
  export const fireAuthErrorEvent = (): void => {
    window.dispatchEvent(new CustomEvent('auth-error', { detail: 'Unauthorized access' }));
  };