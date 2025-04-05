// src/main.tsx

import React, { StrictMode } from "react"; // Ensure React is imported
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter } from 'react-router'; // Correct import path for v6+

// --- CHART.JS REGISTRATION (Centralized) ---
import {
  Chart as ChartJS,
  CategoryScale,  // Scale for X-axis in bar/line charts
  LinearScale,    // Scale for Y-axis in bar/line charts
  BarElement,     // The actual bar shape for bar charts
  PointElement,   // The points on line charts
  LineElement,    // The lines connecting points in line charts
  Title,          // Plugin for chart titles
  Tooltip,        // Plugin for tooltips on hover
  Legend,         // Plugin for chart legends
  Filler          // Plugin for area fills below line charts ('fill: true')
} from 'chart.js';

// Register all components, scales, and plugins used across the entire application ONCE
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

import theme from "./theme.ts"; // Your MUI theme
import App from "./App.tsx";     // Your main App component
import queryClient from './lib/queryClient'; // Import the configured instance

// Get the root element
const rootElement = document.getElementById("root");

// Ensure the root element exists before trying to render
if (!rootElement) {
  throw new Error("Failed to find the root element with ID 'root'");
}

// Create the React root
const root = createRoot(rootElement);

// Render the application
root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <BrowserRouter> {/* Provides routing context */}
          <App />
        </BrowserRouter>
      </ThemeProvider>
      {/* Optional DevTools */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>
);