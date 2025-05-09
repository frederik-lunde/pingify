import React, { createContext, useContext } from "react";
import { AuthContextType } from "../types";
import { useAuthCore } from "../hooks/api/useAuth";

type CoreAuthContextType = Omit<AuthContextType, 'login' | 'register'>;

const AuthContext = createContext<CoreAuthContextType | null>(null);

/**
 * Provides authentication context to its children.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthCore();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to access the authentication context.
 */
export const useAuth = (): CoreAuthContextType | null => {
  const context = useContext(AuthContext);
  return context;
};