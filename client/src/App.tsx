// src/App.tsx
import { Routes, Route } from "react-router";
import { CssBaseline, Box, Alert } from "@mui/material";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Core Components & Pages
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import WebsiteDetails from "./pages/WebsiteDetails";
import WebsiteSettings from "./pages/WebsiteSettings";
import AddWebsite from "./pages/AddWebsite";
import Login from "./pages/Login";
import Register from "./pages/Register";
import IncidentsPage from "./pages/Incidents";
import ProfilePage from "./pages/Profile";

// Context
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useApplyUserThemePreference } from "./context/ThemeContext";
import { TvModeProvider, useTvMode } from "./context/TvModeContext";

// Wrapper Components for Protected Routes
function WebsiteDetailsWrapper() {
    return (
        <ProtectedRoute>
            <WebsiteDetails />
        </ProtectedRoute>
    );
}

function WebsiteSettingsWrapper() {
    return (
        <ProtectedRoute>
            <WebsiteSettings />
        </ProtectedRoute>
    );
}

// Component containing Navbar and Routes
function AppContent() {
    const { user } = useAuth();
    const { isTvMode } = useTvMode();
    useApplyUserThemePreference();

    return (
        <>
            {user && !isTvMode && <Navbar />}
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected Routes */}
                <Route path="/" element={ <ProtectedRoute><Dashboard /></ProtectedRoute> } />
                <Route path="/website/:websiteId" element={<WebsiteDetailsWrapper />} />
                <Route path="/website/:websiteId/settings" element={<WebsiteSettingsWrapper />} />
                <Route path="/add-website" element={ <ProtectedRoute><AddWebsite /></ProtectedRoute> } />
                <Route path="/incidents" element={ <ProtectedRoute><IncidentsPage /></ProtectedRoute> } />
                {/* Add the Profile Page Route */}
                <Route path="/profile" element={ <ProtectedRoute><ProfilePage /></ProtectedRoute> } />

                {/* Fallback for unknown routes */}
                <Route path="*" element={
                    <Box sx={{ p: 4, mt: user && !isTvMode ? 8 : 2, textAlign: 'center' }}>
                        <Alert severity="warning">Page Not Found (404)</Alert>
                    </Box>
                } />
            </Routes>
        </>
    );
}

// Main App component
function App() {
    return (
        <>
            <CssBaseline />
            <AuthProvider>
                <TvModeProvider>
                    <AppContent />
                </TvModeProvider>
            </AuthProvider>
            {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </>
    );
}

export default App;