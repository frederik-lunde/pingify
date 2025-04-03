// src/context/AuthContext.tsx
import React, { createContext, useContext } from "react";
import { AuthContextType } from "../types"; // Adjust path
import { useAuthCore } from "../hooks/api/useAuth"; // Correct import path

// Type for the context value, omitting login/register as they are handled by mutations
type CoreAuthContextType = Omit<AuthContextType, 'login' | 'register'>;

// Create the context with a null default value
const AuthContext = createContext<CoreAuthContextType | null>(null);

// AuthProvider component that uses the core auth hook
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthCore(); // Use the refactored core hook

  // The value provided includes user, token, loading, error, logout
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

// Custom hook for consuming the auth context
export const useAuth = (): CoreAuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    // This error means useAuth was called outside of an AuthProvider
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Exporting AuthProvider as default might be convention, but named exports are fine too
// export default AuthProvider;