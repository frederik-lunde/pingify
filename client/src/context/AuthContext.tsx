// src/context/AuthContext.tsx
import React, { createContext, useContext } from 'react';
import { AuthContextType } from '../types';
import { useAuth as useAuthHook } from '../hooks/api/useAuth';

// Create the auth context with null as initial value
const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Use our new auth hook for all the authentication logic
  const auth = useAuthHook();
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;