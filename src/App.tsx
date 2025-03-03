import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import CreateUser from './pages/CreateUser';
import { CssBaseline } from '@mui/material';
import * as React from 'react';
import ButtonAppBar from './components/ButtonAppBar'; // Update the path as needed
import TemporaryDrawer from './components/TemporaryDrawer'; // Update the path as needed

function App() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const handleDrawerOpen = () => {
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  return (
    <BrowserRouter>
      <CssBaseline />
      <ButtonAppBar onMenuClick={handleDrawerOpen} drawerOpen={drawerOpen} />
      <TemporaryDrawer open={drawerOpen} onClose={handleDrawerClose} />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/create" element={<CreateUser />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;