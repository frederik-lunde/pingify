import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import CreateUser from './pages/CreateUser';
import { CssBaseline } from '@mui/material';



function App() {
 

  return (
    <BrowserRouter>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/create" element={<CreateUser />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;