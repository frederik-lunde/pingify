// client/src/components/ProtectedRoute.tsx
import React from "react";
import { Navigate, useLocation } from "react-router"; 
import { useAuth } from "../context/AuthContext";
import LoadingScreen from "./common/LoadingScreen"; // Assuming LoadingScreen component exists

interface ProtectedRouteProps {
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, token } = useAuth(); // Get user, loading state, and token
  const location = useLocation();

  // 1. Show loading screen while the initial authentication check is running
  if (loading) {
    // console.debug("ProtectedRoute: Auth loading..."); // Debugging log
    return <LoadingScreen />;
  }

  // 2. If loading is finished and there's no user (and no token), redirect to login
  // Checking token helps handle edge cases where user object might be briefly null during refetch
   if (!user && !token) {
    // console.debug("ProtectedRoute: No user/token found, redirecting to login."); // Debugging log
    // Pass the current location state so user can be redirected back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. If loading is finished and user exists (or token exists), render the requested component
  // console.debug("ProtectedRoute: User authenticated, rendering children."); // Debugging log
  return children;
};

export default ProtectedRoute;