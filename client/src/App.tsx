// client/src/App.tsx
import { BrowserRouter as Router, Routes, Route, useParams } from "react-router"; 
import { CssBaseline, Box, CircularProgress, Alert } from "@mui/material"; // MUI components
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'; // Use non-production import directly

// Core Components & Pages
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute"; // Handles auth check
import Dashboard from "./pages/Dashboard";
import WebsiteDetails from "./pages/WebsiteDetails"; // Component, not page
import WebsiteSettings from "./pages/WebsiteSettings"; // Page
import AddWebsite from "./pages/AddWebsite"; // Page
import Login from "./pages/Login"; // Page
import Register from "./pages/Register"; // Page

// Context & Query Client
import { AuthProvider, useAuth } from "./context/AuthContext";
import { queryClient } from './lib/queryClient'; // Import configured QueryClient

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
  const { user, loading } = useAuth(); // Get user and initial loading state

  // Show loading screen while initial auth check is in progress
  // Note: ProtectedRoute also shows a loading screen, so this might be redundant
  // if Navbar isn't essential during that initial check. Consider simplifying.
  // if (loading) {
  //   return <LoadingScreen />; // Or just return null if ProtectedRoute handles loading UI
  // }

  return (
    <>
      {/* Render Navbar only if user is authenticated */}
      {user && <Navbar />}
      {/* Define application routes */}
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
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Alert severity="warning">Page Not Found</Alert>
            </Box>
        } />
      </Routes>
    </>
  );
}

// Main App component - Sets up providers
function App() {
  return (
    <Router>
      <QueryClientProvider client={queryClient}>
          <CssBaseline />
          <AuthProvider>
            {/* AppContent includes Navbar (conditional) and Routes */}
            <AppContent />
          </AuthProvider>
          {/* React Query DevTools (only renders in development) */}
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </Router>
  );
}

export default App;