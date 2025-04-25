// src/theme.ts
import { createTheme } from "@mui/material/styles";
// Import necessary colors including teal/cyan
import { blue, orange, deepOrange, grey, green, red, yellow, teal, cyan } from "@mui/material/colors";

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
      default: "#f4f6f8",
      paper: "#ffffff",
    },
    text: {
      primary: "#1f2937",
      secondary: "#6b7280",
    },
    primary: {
      main: '#3f51b5', // Indigo
    },
    secondary: {
      main: '#f50057', // Pink
    },
    success: {
       main: green[600], // Standard Green (#43a047)
    },
    warning: {
        main: orange[700], // Standard Orange/Amber (#f57c00)
    },
    error: {
        main: red[600], // Standard Red (#e53935)
    },
    info: {
        main: blue[600], // Standard Blue (#1e88e5)
    },
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
      main: '#90caf9', // Lighter blue
    },
    secondary: {
      main: '#f48fb1', // Lighter pink
    },
    success: {
       main: green[400], // Lighter Green (#66bb6a)
    },
    warning: {
        main: orange[400], // Lighter Orange (#ffa726)
    },
    error: {
        main: red[400], // Lighter Red (#ef5350)
    },
    info: {
        main: blue[300], // Lighter Blue (#64b5f6)
    },
  },
  typography: commonTypography,
});

// Define the colorblind-friendly theme (based on dark)
export const colorblindTheme = createTheme({
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
      // Keep primary as light blue for interactive elements
      main: blue[300], // Light Blue (#64b5f6)
    },
    secondary: {
      main: '#f48fb1', // Inherit from dark
    },

    // --- Colorblind Friendly Status Colors ---
    // Ensure distinct hues for statuses, separate from primary blue.
    success: {
      // Use Teal/Cyan for Success/Online - distinct from blue primary
      main: teal[200], // Light Teal (#80cbc4) - Good contrast on dark
      // Alternatively: cyan[300] (#4dd0e1)
    },
    warning: {
      // Yellow for Warning/Slow
      main: yellow[600], // Vibrant Yellow (#fdd835)
    },
    error: {
      // Deep Orange for Error/Offline
      main: deepOrange[400], // Deep Orange (#ff7043)
    },
    info: {
      // Grey for Info (Neutral)
      main: grey[500], // Medium Grey (#9e9e9e)
    },
  },
  typography: commonTypography,
});