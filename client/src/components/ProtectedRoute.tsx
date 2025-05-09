import React from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";
import LoadingScreen from "./common/LoadingScreen";
import { AuthContextType } from "../types";

interface ProtectedRouteProps {
  children: React.ReactElement;
}

/**
 * A route component that protects child routes from unauthenticated access.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const auth = useAuth() as AuthContextType | null;
  const location = useLocation();

  if (!auth || auth.loading) {
    return <LoadingScreen message="Verifying access..." />;
  }

  if (!auth.user && !auth.token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};
export default ProtectedRoute;