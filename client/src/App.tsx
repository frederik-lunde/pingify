import { Routes, Route } from "react-router";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import ProtectedRoute from "./components/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import WebsiteDetails from "./pages/WebsiteDetails";
import WebsiteSettings from "./pages/WebsiteSettings";
import AddWebsite from "./pages/AddWebsite";
import Login from "./pages/Login";
import Register from "./pages/Register";
import IncidentsPage from "./pages/Incidents";
import ProfilePage from "./pages/Profile";
import NotFoundPage from "./pages/NotFound";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProviderWrapper } from "./context/ThemeContext";
import { TvModeProvider } from "./context/TvModeContext";

/**
 * Defines the application's routing structure.
 */
function AppRoutes() {
    return (
        <Routes>
            {}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            {}
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
            {}
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
}

/**
 * Root component of the application, sets up providers and routes.
 */
function App() {
    return (
        <>
            {}
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