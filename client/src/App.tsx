import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router'; // 1. Import useParams
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import WebsiteDetails from './pages/WebsiteDetails';
import WebsiteSettings from './pages/WebsiteSettings';
import AddWebsite from './pages/AddWebsite';
import Login from './pages/Login';
import Register from './pages/Register';
import { CssBaseline } from '@mui/material';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

function WebsiteDetailsWrapper() {
  const { id } = useParams<{ id: string }>(); 

  return (
    <ProtectedRoute key={id}> 
      <WebsiteDetails />
    </ProtectedRoute>
  );
}

function WebsiteSettingsWrapper() {
    const { id } = useParams<{ id: string }>(); 
    return (
      <ProtectedRoute key={id}> 
        <WebsiteSettings />
      </ProtectedRoute>
    );
}


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
          element={<WebsiteDetailsWrapper />} 
        />
        <Route
          path="/website/:id/settings"
          element={<WebsiteSettingsWrapper />} 
        />
        <Route
          path="/add-website"
          element={
            <ProtectedRoute>
              <AddWebsite />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <CssBaseline />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;