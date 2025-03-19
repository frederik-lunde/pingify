import { BrowserRouter, Routes, Route } from 'react-router';
import Dashboard from './pages/Dashboard';
import WebsiteDetails from './components/WebsiteDetails';
import { CssBaseline } from '@mui/material';
import Navbar from './components/Navbar'; 

function App() {
  return (
    <BrowserRouter>
      <CssBaseline />
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/website/:id" element={<WebsiteDetails />} />
        {/* <Route path="/create" element={<CreateUser />} /> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;