// client/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import WebsiteDetails from './pages/WebsiteDetails';
import Login from './pages/Login';
import Register from './pages/Register';
import { CssBaseline } from '@mui/material';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

function AppContent() {
  const { user } = useAuth();

  return (
    <>
      {user && <Navbar />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/website/:id"
          element={
            <ProtectedRoute>
              <WebsiteDetails />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <CssBaseline />
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
