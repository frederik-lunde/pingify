// client/src/App.tsx

// Import necessary routing components from react-router
import { Routes, Route, useParams } from "react-router";
// Import MUI components
import { CssBaseline, Box, Alert } from "@mui/material";
// NOTE: QueryClientProvider is removed as it should be in main.tsx
// NOTE: ReactQueryDevtools can be kept here OR moved entirely to main.tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Core Components & Pages
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute"; // Handles auth check
import Dashboard from "./pages/Dashboard";
import WebsiteDetails from "./pages/WebsiteDetails";
import WebsiteSettings from "./pages/WebsiteSettings";
import AddWebsite from "./pages/AddWebsite";
import Login from "./pages/Login";
import Register from "./pages/Register";

// Context
import { AuthProvider, useAuth } from "./context/AuthContext";
// NOTE: queryClient import is removed as the Provider handles providing it

// Wrapper for Website Details Route
// No longer strictly needed as the component itself uses useParams, but kept for structure if preferred
function WebsiteDetailsWrapper() {
  // Validation and parsing happens inside the WebsiteDetails component using useParams
  return (
    <ProtectedRoute>
      <WebsiteDetails />
    </ProtectedRoute>
  );
}

// Wrapper for Website Settings Route
// No longer strictly needed as the component itself uses useParams, but kept for structure if preferred
function WebsiteSettingsWrapper() {
   // Validation and parsing happens inside the WebsiteSettings component using useParams
  return (
    <ProtectedRoute>
      <WebsiteSettings />
    </ProtectedRoute>
  );
}

// Component containing Navbar and Routes, conditionally rendered based on auth state
function AppContent() {
  const { user } = useAuth(); // Get user state (loading state might be handled within ProtectedRoute/useAuth)

  return (
    <>
      {/* Render Navbar only if user is authenticated */}
      {user && <Navbar />}
      {/* Define application routes - These Routes need a Router context provided higher up (in main.tsx) */}
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes */}
        <Route path="/" element={ <ProtectedRoute><Dashboard /></ProtectedRoute> } />
        {/* Use :websiteId for parameter name */}
        <Route path="/website/:websiteId" element={<WebsiteDetailsWrapper />} />
        <Route path="/website/:websiteId/settings" element={<WebsiteSettingsWrapper />} />
        <Route path="/add-website" element={ <ProtectedRoute><AddWebsite /></ProtectedRoute> } />

        {/* Fallback for unknown routes (Optional) */}
        <Route path="*" element={
            <Box sx={{ p: 4, mt: 8, textAlign: 'center' }}> {/* Added margin top */}
                <Alert severity="warning">Page Not Found (404)</Alert>
            </Box>
        } />
      </Routes>
    </>
  );
}

// Main App component - Sets up providers (excluding Router and QueryClientProvider)
function App() {
  return (
    // No <Router> or <QueryClientProvider> needed here - they are in main.tsx
    <> {/* Using React Fragment as a wrapper */}
      <CssBaseline /> {/* Apply baseline styles */}
      <AuthProvider> {/* Provide Authentication context */}
        {/* AppContent includes Navbar (conditional) and Routes */}
        <AppContent />
      </AuthProvider>   
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </>
  );
}

export default App;