import { BrowserRouter, Routes, Route } from 'react-router';
import Dashboard from './pages/Dashboard';
import WebsiteDetails from './components/WebsiteDetails';
import { CssBaseline } from '@mui/material';
import ButtonAppBar from './components/ButtonAppBar'; 

function App() {
  return (
    <BrowserRouter>
      <CssBaseline />
      <ButtonAppBar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/website/:id" element={<WebsiteDetails />} />
        {/* <Route path="/create" element={<CreateUser />} /> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;