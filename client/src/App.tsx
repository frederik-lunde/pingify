// src/App.tsx
import { Routes, Route } from "react-router";
// import { CssBaseline } from "@mui/material"; // REMOVE CssBaseline import here
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Core Components & Pages
import ProtectedRoute from "./components/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import WebsiteDetails from "./pages/WebsiteDetails";
import WebsiteSettings from "./pages/WebsiteSettings";
import AddWebsite from "./pages/AddWebsite";
import Login from "./pages/Login";
import Register from "./pages/Register";
import IncidentsPage from "./pages/Incidents";
import ProfilePage from "./pages/Profile"; // Corrected path
import NotFoundPage from "./pages/NotFound";

// Context
import { AuthProvider } from "./context/AuthContext";
import { ThemeProviderWrapper } from "./context/ThemeContext";
import { TvModeProvider } from "./context/TvModeContext";

// Component containing Routes
function AppRoutes() {
    return (
        <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes within MainLayout */}
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
            </Route>

            {/* Catch-all 404 route */}
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
}

// Main App component
function App() {
    return (
        <>
            {/* CssBaseline is now handled within ThemeProviderWrapper */}
            <AuthProvider>
                <ThemeProviderWrapper>
                    <TvModeProvider>
                        <AppRoutes />
                    </TvModeProvider>
                </ThemeProviderWrapper>
            </AuthProvider>
            {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </>
    );
}

export default App;