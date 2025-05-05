import React, { createContext, useContext } from "react";
import { AuthContextType } from "../types";
import { useAuthCore } from "../hooks/api/useAuth";

// Define the type for the context value, allowing null for initial state
type CoreAuthContextType = Omit<AuthContextType, 'login' | 'register'>;
const AuthContext = createContext<CoreAuthContextType | null>(null); // Keep null default

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthCore(); // Assume useAuthCore handles its loading internally

  // Provide the value from useAuthCore. If it's null/undefined initially, consumers should handle it.
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

// Modify useAuth to return the context value directly, which might be null initially
export const useAuth = (): CoreAuthContextType | null => {
  const context = useContext(AuthContext);
  return context; 
};