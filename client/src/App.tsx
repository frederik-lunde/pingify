/*
src/App.tsx
*/
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

// Context
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useApplyUserThemePreference } from "./context/ThemeContext";
// Updated context import
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
  // Use the updated hook and variable name
  const { isTvMode } = useTvMode();
  // Apply theme preference hook
  useApplyUserThemePreference();

  return (
    <>
      {/* Conditionally render Navbar based on user AND TV mode */}
      {/* Navbar is hidden if not logged in OR if in TV mode */}
      {user && !isTvMode && <Navbar />}
      {/* Define application routes */}
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

        {/* Fallback for unknown routes */}
        <Route path="*" element={
            // Adjust top margin based on whether Navbar is rendered (user logged in and not in TV mode)
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
      {/* Apply baseline CSS normalization */}
      <CssBaseline />
      {/* Provide Authentication context */}
      <AuthProvider>
        {/* Provide the renamed TV Mode context */}
        <TvModeProvider>
          {/* Render main application content */}
          <AppContent />
        </TvModeProvider>
      </AuthProvider>
      {/* Optionally include React Query DevTools in development */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </>
  );
}

export default App;