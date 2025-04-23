// src/App.tsx
import { Routes, Route } from "react-router";
import { CssBaseline } from "@mui/material"; // Removed Alert
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Core Components & Pages
import ProtectedRoute from "./components/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout"; // Import MainLayout
import Dashboard from "./pages/Dashboard";
import WebsiteDetails from "./pages/WebsiteDetails";
import WebsiteSettings from "./pages/WebsiteSettings";
import AddWebsite from "./pages/AddWebsite";
import Login from "./pages/Login";
import Register from "./pages/Register";
import IncidentsPage from "./pages/Incidents";
import ProfilePage from "./pages/Profile";
import NotFoundPage from "./pages/NotFound"; // Import NotFoundPage

// Context
import { AuthProvider } from "./context/AuthContext"; // Removed useAuth here
import { useApplyUserThemePreference } from "./context/ThemeContext";
import { TvModeProvider } from "./context/TvModeContext"; // Removed useTvMode here

// Component containing Routes - Navbar is now in MainLayout
function AppRoutes() {
    useApplyUserThemePreference(); // Apply theme preference based on context

    return (
        <Routes>
            {/* Public routes - No Navbar */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Routes requiring auth and using the MainLayout (with Navbar) */}
            <Route
                element={
                    <ProtectedRoute>
                        <MainLayout />
                    </ProtectedRoute>
                }
            >
                <Route path="/" element={<Dashboard />} />
                <Route path="/website/:websiteId" element={<WebsiteDetails />} />
                <Route path="/website/:websiteId/settings" element={<WebsiteSettings />} />
                <Route path="/add-website" element={<AddWebsite />} />
                <Route path="/incidents" element={<IncidentsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                {/* Add other protected routes needing the navbar here */}
            </Route>

            {/* Fallback 404 route - No Navbar */}
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
}

// Main App component
function App() {
    return (
        <>
            <CssBaseline />
            <AuthProvider>
                <TvModeProvider>
                    {/* AppRoutes now handles the routing logic */}
                    <AppRoutes />
                </TvModeProvider>
            </AuthProvider>
            {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </>
    );
}

export default App;