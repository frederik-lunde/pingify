// src/App.tsx

import { Routes, Route } from "react-router"; // Use react-router-dom v6+ imports
import { CssBaseline, Box, Alert } from "@mui/material";
// NOTE: ThemeProvider is removed as it's now handled in main.tsx by ThemeProviderWrapper
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

// Context
import { AuthProvider, useAuth } from "./context/AuthContext";
// NOTE: ThemeProviderWrapper is used in main.tsx

// Wrapper components remain the same
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

  return (
    <>
      {user && <Navbar />}
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes */}
        <Route path="/" element={ <ProtectedRoute><Dashboard /></ProtectedRoute> } />
        <Route path="/website/:websiteId" element={<WebsiteDetailsWrapper />} />
        <Route path="/website/:websiteId/settings" element={<WebsiteSettingsWrapper />} />
        <Route path="/add-website" element={ <ProtectedRoute><AddWebsite /></ProtectedRoute> } />

        {/* Fallback for unknown routes */}
        <Route path="*" element={
            <Box sx={{ p: 4, mt: 8, textAlign: 'center' }}>
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
      {/* CssBaseline applies global resets and background color based on theme */}
      <CssBaseline />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </>
  );
}

export default App;