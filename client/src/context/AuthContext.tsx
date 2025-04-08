// src/context/AuthContext.tsx
import React, { createContext, useContext } from "react";
import { AuthContextType } from "../types"; 
import { useAuthCore } from "../hooks/api/useAuth";

type CoreAuthContextType = Omit<AuthContextType, 'login' | 'register'>;

// Create the context with a null default value
const AuthContext = createContext<CoreAuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthCore();

  //includes user, token, loading, error, logout
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export const useAuth = (): CoreAuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

