// src/main.tsx
import{ StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Remove static ThemeProvider import from MUI
// import { ThemeProvider } from "@mui/material/styles";
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';

// --- CHART.JS REGISTRATION (Centralized) ---
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);
// --- END CHART.JS REGISTRATION ---

// Import the ThemeProviderWrapper from your context
import { ThemeProviderWrapper } from "./context/ThemeContext";
import App from "./App.tsx";
import queryClient from './lib/queryClient';

// Get the root element
const rootElement = document.getElementById("root");

// Ensure the root element exists
if (!rootElement) {
  throw new Error("Failed to find the root element with ID 'root'");
}

// Create the React root
const root = createRoot(rootElement);

// Render the application
root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Wrap the entire app with the dynamic theme provider */}
      <ThemeProviderWrapper>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProviderWrapper>
    </QueryClientProvider>
  </StrictMode>
);