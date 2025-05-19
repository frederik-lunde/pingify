import{ StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
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

import { ThemeProviderWrapper } from "./context/ThemeContext";
import App from "./App.tsx";
import queryClient from './lib/queryClient';


const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element with ID 'root'");
}
const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProviderWrapper>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProviderWrapper>
    </QueryClientProvider>
  </StrictMode>
);