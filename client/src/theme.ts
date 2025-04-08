// src/theme.ts
import { createTheme } from "@mui/material/styles";

// Define common typography settings
const commonTypography = {
  fontFamily: [
    "system-ui",
    "Avenir",
    "Helvetica",
    "Arial",
    "sans-serif",
  ].join(","),
  fontWeightRegular: 400,
  h1: {
    fontSize: "2.5rem",
    fontWeight: 500,
  },
  body1: {
    fontSize: "1rem",
    fontWeight: 400,
  },
};

// Define the light theme
export const lightTheme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#f4f6f8", // Lighter grey
      paper: "#ffffff", // White
    },
    text: {
      primary: "#1f2937", // Dark grey
      secondary: "#6b7280", // Medium grey
    },
    primary: {
      main: '#3f51b5', // Example primary color
    },
    secondary: {
      main: '#f50057', // Example secondary color
    },
    // Add other light theme specific overrides if needed
  },
  typography: commonTypography,
});

// Define the dark theme
export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#121212",
      paper: "#1e1e1e",
    },
    text: {
      primary: "#ffffff",
      secondary: "#b3b3b3",
    },
    primary: {
      main: '#90caf9', // Lighter blue for dark mode
    },
    secondary: {
      main: '#f48fb1', // Lighter pink for dark mode
    },
     // Add other dark theme specific overrides if needed
  },
  typography: commonTypography,
});

