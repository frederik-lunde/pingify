import React from "react";
// Use react-router-dom for Navigate and useLocation
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";
import LoadingScreen from "./common/LoadingScreen"; // Ensure this path is correct
// Import necessary types
import { AuthContextType } from "../types";

interface ProtectedRouteProps {
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  // Get the full auth context object
  const auth = useAuth() as AuthContextType | null; // Cast if needed, based on useAuth return type
  const location = useLocation();

  // 1. Show loading screen if auth context is not yet available OR if it's explicitly loading
  // This handles both the initial null state and the loading flag
  if (!auth || auth.loading) {
    // console.debug("ProtectedRoute: Auth loading or context unavailable...");
    return <LoadingScreen message="Verifying access..." />; // Use a relevant message
  }

  // 2. If loading is finished and auth context exists, check for user/token
  // At this point, we know 'auth' is not null and 'auth.loading' is false.
  if (!auth.user && !auth.token) {
    // console.debug("ProtectedRoute: No user/token found after loading, redirecting to login.");
    // Redirect to login, preserving the intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. If loading is finished and user/token exists, render the protected component
  // console.debug("ProtectedRoute: User authenticated, rendering children.");
  return children;
};

export default ProtectedRoute;