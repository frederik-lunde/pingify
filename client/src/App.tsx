import{ Suspense, lazy } from 'react'; 
import { Routes, Route } from "react-router"; 
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';


import { AuthProvider } from "./context/AuthContext";
import { TvModeProvider } from "./context/TvModeContext";


import ProtectedRoute from "./components/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";


const Dashboard = lazy(() => import("./pages/Dashboard"));
const WebsiteDetails = lazy(() => import("./pages/WebsiteDetails"));
const WebsiteSettings = lazy(() => import("./pages/WebsiteSettings"));
const AddWebsite = lazy(() => import("./pages/AddWebsite"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const IncidentsPage = lazy(() => import("./pages/Incidents"));
const ProfilePage = lazy(() => import("./pages/Profile"));
const NotFoundPage = lazy(() => import("./pages/NotFound"));

/**
 * Defines the application's routing structure.
 */
function AppRoutes() {
    return (
        
        <Suspense fallback={<div>Loading page...</div>}> {/* Or a nice spinner component */}
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected Routes */}
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

                {/* Not Found Route */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </Suspense>
    );
}

/**
 * Root component of the application, sets up providers and routes.
 */
function App() {
    return (
        <>
            {/* Context Providers */}
            <AuthProvider>
                    <TvModeProvider>
                        <AppRoutes />
                    </TvModeProvider>
            </AuthProvider>
            {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </>
    );
}
export default App;