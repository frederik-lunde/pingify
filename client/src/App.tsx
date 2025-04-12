// src/App.tsx
import { Routes, Route } from "react-router";
import { CssBaseline, Box, Alert } from "@mui/material";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Core Components & Pages
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
// *** Import Page Components ***
import WebsiteDetails from "./pages/WebsiteDetails";
import WebsiteSettings from "./pages/WebsiteSettings";
import AddWebsite from "./pages/AddWebsite";
import Login from "./pages/Login";
import Register from "./pages/Register";
// --- Import the new IncidentsPage ---
import IncidentsPage from "./pages/Incidents"; // Adjust path if needed

// Context
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useApplyUserThemePreference } from "./context/ThemeContext"; // Adjust path if needed
import { FocusModeProvider, useFocusMode } from "./context/FocusModeContext"; // Adjust path if needed

// --- Correctly Defined Wrapper Components ---
function WebsiteDetailsWrapper() {
  // This component wraps WebsiteDetails in ProtectedRoute
  return (
    <ProtectedRoute>
      <WebsiteDetails />
    </ProtectedRoute>
  );
}

function WebsiteSettingsWrapper() {
  // This component wraps WebsiteSettings in ProtectedRoute
  return (
    <ProtectedRoute>
      <WebsiteSettings />
    </ProtectedRoute>
  );
}
// --- End Wrapper Components ---

// Component containing Navbar and Routes
function AppContent() {
  const { user } = useAuth();
  const { isFocusMode } = useFocusMode();
  // Apply theme preference (assuming this hook exists and works)
  useApplyUserThemePreference();

  return (
    <>
      {/* Conditionally render Navbar based on user AND focus mode */}
      {user && !isFocusMode && <Navbar />}
      {/* Define application routes */}
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes */}
        <Route path="/" element={ <ProtectedRoute><Dashboard /></ProtectedRoute> } />
        {/* Use the correctly defined wrapper components */}
        <Route path="/website/:websiteId" element={<WebsiteDetailsWrapper />} />
        <Route path="/website/:websiteId/settings" element={<WebsiteSettingsWrapper />} />
        <Route path="/add-website" element={ <ProtectedRoute><AddWebsite /></ProtectedRoute> } />
        {/* --- Add the new Incidents Page Route --- */}
        <Route path="/incidents" element={ <ProtectedRoute><IncidentsPage /></ProtectedRoute> } />

        {/* Fallback for unknown routes */}
        <Route path="*" element={
            // Adjust top margin based on whether Navbar is rendered
            <Box sx={{ p: 4, mt: user && !isFocusMode ? 8 : 2, textAlign: 'center' }}>
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
        {/* Provide Focus Mode context */}
        <FocusModeProvider>
          {/* Render main application content */}
          <AppContent />
        </FocusModeProvider>
      </AuthProvider>
      {/* Optionally include React Query DevTools in development */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </>
  );
}

export default App;